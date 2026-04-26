package networkservice

import (
	"context"
	"fmt"
	"strings"

	egressservicev1 "code-code.internal/go-contract/platform/egress/v1"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	"code-code.internal/platform-k8s/networkservice/egresspolicies"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

// Config wires platform-network-service to Kubernetes-backed egress policy storage.
type Config struct {
	Client                   ctrlclient.Client
	Reader                   ctrlclient.Reader
	Namespace                string
	EgressGatewayNamespace   string
	EgressGatewayServiceHost string
	EgressGatewaySelector    string
}

type Server struct {
	egressservicev1.UnimplementedEgressServiceServer

	policies *egresspolicies.Service
}

func NewServer(config Config) (*Server, error) {
	if config.Reader == nil {
		return nil, fmt.Errorf("platformk8s/networkservice: reader is nil")
	}
	if config.Client == nil {
		return nil, fmt.Errorf("platformk8s/networkservice: client is nil")
	}
	if strings.TrimSpace(config.Namespace) == "" {
		return nil, fmt.Errorf("platformk8s/networkservice: namespace is empty")
	}
	policies, err := egresspolicies.NewService(egresspolicies.ServiceConfig{
		Client:    config.Client,
		Reader:    config.Reader,
		Namespace: config.Namespace,
		GatewayRuntime: egresspolicies.GatewayRuntimeConfig{
			Namespace:   config.EgressGatewayNamespace,
			ServiceHost: config.EgressGatewayServiceHost,
			Selector:    config.EgressGatewaySelector,
		},
	})
	if err != nil {
		return nil, err
	}
	return &Server{policies: policies}, nil
}

func (s *Server) ListEgressPolicies(ctx context.Context, _ *managementv1.ListEgressPoliciesRequest) (*managementv1.ListEgressPoliciesResponse, error) {
	items, err := s.policies.List(ctx)
	if err != nil {
		return nil, err
	}
	return &managementv1.ListEgressPoliciesResponse{Items: items}, nil
}

func (s *Server) UpdateEgressPolicy(ctx context.Context, request *managementv1.UpdateEgressPolicyRequest) (*managementv1.UpdateEgressPolicyResponse, error) {
	item, err := s.policies.Update(ctx, request.GetPolicy())
	if err != nil {
		return nil, err
	}
	return &managementv1.UpdateEgressPolicyResponse{Item: item}, nil
}

func (s *Server) GetEgressRuntimePolicy(_ context.Context, request *egressservicev1.GetEgressRuntimePolicyRequest) (*egressservicev1.GetEgressRuntimePolicyResponse, error) {
	policy, err := s.policies.ResolveRuntimePolicy(request.GetPolicyId(), request.GetRuntimeUrl())
	if err != nil {
		return nil, err
	}
	return &egressservicev1.GetEgressRuntimePolicyResponse{Policy: policy}, nil
}
