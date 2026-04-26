package modelservice

import (
	"context"
	"fmt"
	"strings"
	"time"

	"code-code.internal/go-contract/domainerror"
	modelcatalogdiscoveryv1 "code-code.internal/go-contract/model_catalog_discovery/v1"
	"code-code.internal/platform-k8s/modelcatalogdiscovery"
	"code-code.internal/platform-k8s/modelcatalogsources"
	"golang.org/x/sync/singleflight"
	"google.golang.org/protobuf/encoding/protojson"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

type CatalogProbeExecutor struct {
	httpClientFactory         modelcatalogdiscovery.HTTPClientFactory
	client                    ctrlclient.Client
	credentialSecretNamespace string
	group                     singleflight.Group
	metrics                   *catalogProbeMetrics
}

func NewCatalogProbeExecutor(
	httpClientFactory modelcatalogdiscovery.HTTPClientFactory,
	client ctrlclient.Client,
	credentialSecretNamespace string,
) (*CatalogProbeExecutor, error) {
	if httpClientFactory == nil {
		return nil, fmt.Errorf("platformk8s/modelservice: http client factory is nil")
	}
	if client == nil {
		return nil, fmt.Errorf("platformk8s/modelservice: client is nil")
	}
	if strings.TrimSpace(credentialSecretNamespace) == "" {
		return nil, fmt.Errorf("platformk8s/modelservice: credential secret namespace is empty")
	}
	metrics, err := registerCatalogProbeMetrics()
	if err != nil {
		return nil, err
	}
	return &CatalogProbeExecutor{
		httpClientFactory:         httpClientFactory,
		client:                    client,
		credentialSecretNamespace: strings.TrimSpace(credentialSecretNamespace),
		metrics:                   metrics,
	}, nil
}

func (e *CatalogProbeExecutor) ProbeModelIDs(ctx context.Context, request modelcatalogsources.ProbeRequest) ([]string, error) {
	if e == nil {
		return nil, fmt.Errorf("platformk8s/modelservice: catalog probe executor is nil")
	}
	operation := request.Operation
	if operation == nil {
		operation = modelcatalogdiscovery.DefaultAPIKeyDiscoveryOperation(request.Protocol)
	}
	requestKey := catalogProbeSingleflightKey(request, operation)
	leaseKey := catalogProbeLeaseKey(request, requestKey)
	value, err, _ := e.group.Do(requestKey, func() (any, error) {
		started := time.Now()
		var modelIDs []string
		var probeErr error
		defer func() {
			e.metrics.record(request, operation, len(modelIDs), started, probeErr)
		}()
		release, lockErr := e.acquireCatalogProbeLease(ctx, leaseKey)
		if lockErr != nil {
			probeErr = lockErr
			return nil, lockErr
		}
		defer release()
		modelIDs, probeErr = e.probe(ctx, request, operation)
		return modelIDs, probeErr
	})
	if err != nil {
		return nil, err
	}
	modelIDs, _ := value.([]string)
	return modelIDs, nil
}

func (e *CatalogProbeExecutor) probe(
	ctx context.Context,
	request modelcatalogsources.ProbeRequest,
	operation *modelcatalogdiscoveryv1.ModelCatalogDiscoveryOperation,
) ([]string, error) {
	var body []byte
	var err error
	if operationUsesCredential(operation, request) {
		body, err = e.fetchAuthenticated(ctx, request, operation)
	} else {
		body, err = e.fetchAnonymous(ctx, request, operation)
	}
	if err != nil {
		return nil, err
	}
	modelIDs, err := modelcatalogdiscovery.ParseModelIDs(body, operation.GetResponseKind())
	if err != nil {
		return nil, err
	}
	if len(modelIDs) == 0 {
		return nil, domainerror.NewValidation("platformk8s/modelservice: no models discovered from operation")
	}
	return modelIDs, nil
}

func (e *CatalogProbeExecutor) fetchAnonymous(
	ctx context.Context,
	request modelcatalogsources.ProbeRequest,
	operation *modelcatalogdiscoveryv1.ModelCatalogDiscoveryOperation,
) ([]byte, error) {
	service, err := modelcatalogdiscovery.NewService(e.httpClientFactory)
	if err != nil {
		return nil, err
	}
	response, err := service.Fetch(ctx, modelcatalogdiscovery.Request{
		BaseURL:       request.BaseURL,
		Headers:       request.Headers,
		Operation:     operation,
		DynamicValues: request.DynamicValues,
	})
	if err != nil {
		return nil, err
	}
	return response.Body, nil
}

func (e *CatalogProbeExecutor) fetchAuthenticated(
	ctx context.Context,
	request modelcatalogsources.ProbeRequest,
	operation *modelcatalogdiscoveryv1.ModelCatalogDiscoveryOperation,
) ([]byte, error) {
	credentialID := strings.TrimSpace(request.AuthRef.GetCredentialId())
	if credentialID == "" {
		return nil, domainerror.NewValidation("platformk8s/modelservice: auth-bound model operation requires auth_ref")
	}
	auth, authHeaders, err := modelcatalogdiscovery.EnvoyAuthContextForOperation(
		request.Protocol,
		e.credentialSecretNamespace,
		credentialID,
		operation,
	)
	if err != nil {
		return nil, err
	}
	headers := request.Headers.Clone()
	for name, values := range authHeaders {
		for _, value := range values {
			headers.Add(name, value)
		}
	}
	service, err := modelcatalogdiscovery.NewService(e.httpClientFactory)
	if err != nil {
		return nil, err
	}
	response, err := service.Fetch(ctx, modelcatalogdiscovery.Request{
		BaseURL:       request.BaseURL,
		Headers:       headers,
		Operation:     operation,
		DynamicValues: request.DynamicValues,
		EnvoyAuth:     auth,
	})
	if err != nil {
		return nil, err
	}
	return response.Body, nil
}

func operationUsesCredential(operation *modelcatalogdiscoveryv1.ModelCatalogDiscoveryOperation, request modelcatalogsources.ProbeRequest) bool {
	if len(operation.GetSecurity()) > 0 {
		return true
	}
	return strings.TrimSpace(request.AuthRef.GetCredentialId()) != ""
}

func catalogProbeSingleflightKey(
	request modelcatalogsources.ProbeRequest,
	operation *modelcatalogdiscoveryv1.ModelCatalogDiscoveryOperation,
) string {
	operationJSON, err := protojson.MarshalOptions{EmitUnpopulated: true}.Marshal(operation)
	if err != nil {
		operationJSON = []byte(operation.String())
	}
	parts := []string{
		request.Protocol.String(),
		strings.TrimSpace(request.BaseURL),
		strings.TrimSpace(request.AuthRef.GetCredentialId()),
		string(operationJSON),
	}
	return strings.Join(parts, "\x00")
}

func catalogProbeLeaseKey(request modelcatalogsources.ProbeRequest, fallback string) string {
	key := strings.TrimSpace(request.ConcurrencyKey)
	if key != "" {
		return key
	}
	return fallback
}
