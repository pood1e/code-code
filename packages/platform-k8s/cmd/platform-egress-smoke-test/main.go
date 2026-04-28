package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	egressv1 "code-code.internal/go-contract/egress/v1"
	egressservicev1 "code-code.internal/go-contract/platform/egress/v1"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	vendorsupport "code-code.internal/platform-k8s/internal/supportservice/vendors/support"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

const (
	defaultAddr        = "127.0.0.1:18081"
	defaultPolicyID    = "code-code-egress"
	defaultAccessSetID = "support.external-rule-set.l7-smoke"
	defaultMode        = "lifecycle"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	addr := envOrDefault("PLATFORM_EGRESS_SMOKE_GRPC_ADDR", defaultAddr)
	policyID := envOrDefault("PLATFORM_EGRESS_SMOKE_POLICY_ID", defaultPolicyID)
	accessSetID := envOrDefault("PLATFORM_EGRESS_SMOKE_ACCESS_SET_ID", defaultAccessSetID)
	mode := envOrDefault("PLATFORM_EGRESS_SMOKE_MODE", defaultMode)

	accessSet, ok := vendorsupport.ExternalRuleSetAccessSet(accessSetID)
	if !ok {
		return fmt.Errorf("smoke access set %q not found", accessSetID)
	}
	if accessSet.GetPolicyId() != "" && policyID != "" && accessSet.GetPolicyId() != policyID {
		return fmt.Errorf("smoke access set policy_id = %q, want %q", accessSet.GetPolicyId(), policyID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return fmt.Errorf("create egress grpc client: %w", err)
	}
	defer conn.Close()
	client := egressservicev1.NewEgressServiceClient(conn)

	switch mode {
	case "lifecycle":
		return runLifecycle(ctx, client, policyID, accessSet)
	case "apply":
		return runApply(ctx, client, policyID, accessSet)
	case "delete":
		return runDelete(ctx, client, policyID, accessSet)
	default:
		return fmt.Errorf("unsupported PLATFORM_EGRESS_SMOKE_MODE %q", mode)
	}
}

func runLifecycle(ctx context.Context, client egressservicev1.EgressServiceClient, policyID string, accessSet *egressv1.ExternalAccessSet) error {
	if _, err := client.DeleteExternalAccessSet(ctx, &egressservicev1.DeleteExternalAccessSetRequest{
		PolicyId:    policyID,
		AccessSetId: accessSet.GetAccessSetId(),
	}); err != nil {
		return fmt.Errorf("pre-clean smoke access set: %w", err)
	}
	if err := requireBaseline(ctx, client, policyID); err != nil {
		return err
	}

	empty := &egressv1.ExternalAccessSet{
		AccessSetId:  accessSet.GetAccessSetId(),
		DisplayName:  accessSet.GetDisplayName(),
		OwnerService: accessSet.GetOwnerService(),
		PolicyId:     accessSet.GetPolicyId(),
	}
	if _, err := client.ApplyExternalAccessSet(ctx, &egressservicev1.ApplyExternalAccessSetRequest{AccessSet: empty}); err == nil {
		return fmt.Errorf("empty ApplyExternalAccessSet unexpectedly succeeded")
	}
	log.Printf("[egress-smoke] empty apply rejected")

	applied := false
	defer func() {
		if !applied {
			return
		}
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_, _ = client.DeleteExternalAccessSet(cleanupCtx, &egressservicev1.DeleteExternalAccessSetRequest{
			PolicyId:    policyID,
			AccessSetId: accessSet.GetAccessSetId(),
		})
	}()

	applyResp, err := applyAccessSet(ctx, client, accessSet)
	if err != nil {
		return err
	}
	applied = true
	if applyResp.GetAddedExternalRuleCount() == 0 && applyResp.GetUpdatedExternalRuleCount() == 0 && applyResp.GetUnchangedExternalRuleCount() == 0 {
		return fmt.Errorf("apply smoke access set returned no resource changes")
	}
	if err := requireAccessSet(ctx, client, policyID, accessSet.GetAccessSetId(), true); err != nil {
		return err
	}
	log.Printf("[egress-smoke] applied %s (added=%d updated=%d unchanged=%d)",
		accessSet.GetAccessSetId(),
		applyResp.GetAddedExternalRuleCount(),
		applyResp.GetUpdatedExternalRuleCount(),
		applyResp.GetUnchangedExternalRuleCount())

	deleteResp, err := deleteAccessSet(ctx, client, policyID, accessSet)
	if err != nil {
		return err
	}
	applied = false
	if got, want := deleteResp.GetRemovedExternalRuleCount(), int32(len(accessSet.GetExternalRules())); got != want {
		return fmt.Errorf("removed external rules = %d, want %d", got, want)
	}
	if got, want := deleteResp.GetRemovedServiceRuleCount(), int32(len(accessSet.GetServiceRules())); got != want {
		return fmt.Errorf("removed service rules = %d, want %d", got, want)
	}
	if got, want := deleteResp.GetRemovedHttpRouteCount(), int32(len(accessSet.GetHttpRoutes())); got != want {
		return fmt.Errorf("removed http routes = %d, want %d", got, want)
	}
	if err := requireAccessSet(ctx, client, policyID, accessSet.GetAccessSetId(), false); err != nil {
		return err
	}
	if err := requireBaseline(ctx, client, policyID); err != nil {
		return err
	}
	log.Printf("[egress-smoke] deleted %s", accessSet.GetAccessSetId())

	secondDelete, err := client.DeleteExternalAccessSet(ctx, &egressservicev1.DeleteExternalAccessSetRequest{
		PolicyId:    policyID,
		AccessSetId: accessSet.GetAccessSetId(),
	})
	if err != nil {
		return fmt.Errorf("second delete smoke access set: %w", err)
	}
	if secondDelete.GetRemovedExternalRuleCount() != 0 || secondDelete.GetRemovedServiceRuleCount() != 0 || secondDelete.GetRemovedHttpRouteCount() != 0 {
		return fmt.Errorf("idempotent delete removed external=%d service=%d http=%d, want all zero",
			secondDelete.GetRemovedExternalRuleCount(),
			secondDelete.GetRemovedServiceRuleCount(),
			secondDelete.GetRemovedHttpRouteCount())
	}
	log.Printf("[egress-smoke] idempotent delete verified")
	return nil
}

func runApply(ctx context.Context, client egressservicev1.EgressServiceClient, policyID string, accessSet *egressv1.ExternalAccessSet) error {
	if _, err := client.DeleteExternalAccessSet(ctx, &egressservicev1.DeleteExternalAccessSetRequest{
		PolicyId:    policyID,
		AccessSetId: accessSet.GetAccessSetId(),
	}); err != nil {
		return fmt.Errorf("pre-clean smoke access set: %w", err)
	}
	if err := requireBaseline(ctx, client, policyID); err != nil {
		return err
	}
	response, err := applyAccessSet(ctx, client, accessSet)
	if err != nil {
		return err
	}
	if err := requireAccessSet(ctx, client, policyID, accessSet.GetAccessSetId(), true); err != nil {
		return err
	}
	log.Printf("[egress-smoke] applied %s (added=%d updated=%d unchanged=%d)",
		accessSet.GetAccessSetId(),
		response.GetAddedExternalRuleCount(),
		response.GetUpdatedExternalRuleCount(),
		response.GetUnchangedExternalRuleCount())
	return nil
}

func runDelete(ctx context.Context, client egressservicev1.EgressServiceClient, policyID string, accessSet *egressv1.ExternalAccessSet) error {
	response, err := deleteAccessSet(ctx, client, policyID, accessSet)
	if err != nil {
		return err
	}
	if err := requireAccessSet(ctx, client, policyID, accessSet.GetAccessSetId(), false); err != nil {
		return err
	}
	if err := requireBaseline(ctx, client, policyID); err != nil {
		return err
	}
	log.Printf("[egress-smoke] deleted %s (external=%d service=%d http=%d)",
		accessSet.GetAccessSetId(),
		response.GetRemovedExternalRuleCount(),
		response.GetRemovedServiceRuleCount(),
		response.GetRemovedHttpRouteCount())
	return nil
}

func applyAccessSet(ctx context.Context, client egressservicev1.EgressServiceClient, accessSet *egressv1.ExternalAccessSet) (*egressservicev1.ApplyExternalAccessSetResponse, error) {
	response, err := client.ApplyExternalAccessSet(ctx, &egressservicev1.ApplyExternalAccessSetRequest{AccessSet: accessSet})
	if err != nil {
		return nil, fmt.Errorf("apply smoke access set: %w", err)
	}
	return response, nil
}

func deleteAccessSet(ctx context.Context, client egressservicev1.EgressServiceClient, policyID string, accessSet *egressv1.ExternalAccessSet) (*egressservicev1.DeleteExternalAccessSetResponse, error) {
	response, err := client.DeleteExternalAccessSet(ctx, &egressservicev1.DeleteExternalAccessSetRequest{
		PolicyId:    policyID,
		AccessSetId: accessSet.GetAccessSetId(),
	})
	if err != nil {
		return nil, fmt.Errorf("delete smoke access set: %w", err)
	}
	return response, nil
}

func requireBaseline(ctx context.Context, client egressservicev1.EgressServiceClient, policyID string) error {
	for _, accessSetID := range []string{
		"support.external-rule-set.bootstrap",
		"support.proxy-preset.preset-proxy",
	} {
		if err := requireAccessSet(ctx, client, policyID, accessSetID, true); err != nil {
			return err
		}
	}
	return nil
}

func requireAccessSet(ctx context.Context, client egressservicev1.EgressServiceClient, policyID string, accessSetID string, wantPresent bool) error {
	item, err := getPolicy(ctx, client, policyID)
	if err != nil {
		return err
	}
	present := false
	for _, accessSet := range item.GetPolicy().GetAccessSets() {
		if accessSet.GetAccessSetId() == accessSetID {
			present = true
			break
		}
	}
	if present != wantPresent {
		return fmt.Errorf("access set %q present = %t, want %t", accessSetID, present, wantPresent)
	}
	return nil
}

func getPolicy(ctx context.Context, client egressservicev1.EgressServiceClient, policyID string) (*managementv1.EgressPolicyView, error) {
	response, err := client.ListEgressPolicies(ctx, &managementv1.ListEgressPoliciesRequest{})
	if err != nil {
		return nil, fmt.Errorf("list egress policies: %w", err)
	}
	for _, item := range response.GetItems() {
		if item.GetPolicy().GetPolicyId() == policyID {
			return item, nil
		}
	}
	return nil, fmt.Errorf("egress policy %q not found", policyID)
}

func envOrDefault(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
