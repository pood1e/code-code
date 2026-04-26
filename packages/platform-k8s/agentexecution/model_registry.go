package agentexecution

import (
	"context"
	"strings"

	"code-code.internal/go-contract/domainerror"
	modelv1 "code-code.internal/go-contract/model/v1"
	modelservicev1 "code-code.internal/go-contract/platform/model/v1"
	"google.golang.org/protobuf/proto"
)

const modelRegistryPageSize int32 = 1000

func (r *RemoteModelRegistry) ResolveRef(ctx context.Context, modelIDOrAlias string) (*modelv1.ModelRef, error) {
	modelIDOrAlias = strings.TrimSpace(modelIDOrAlias)
	if modelIDOrAlias == "" {
		return nil, domainerror.NewValidation("platformk8s/agentexecution: model id or alias is empty")
	}
	definitions, err := r.definitions(ctx)
	if err != nil {
		return nil, err
	}
	if ref, err := resolveDefinitionRef(definitions, modelIDOrAlias, false); err != nil || ref != nil {
		return ref, err
	}
	return resolveDefinitionRef(definitions, modelIDOrAlias, true)
}

func (r *RemoteModelRegistry) Resolve(ctx context.Context, ref *modelv1.ModelRef, override *modelv1.ModelOverride) (*modelv1.ResolvedModel, error) {
	if override != nil {
		return nil, domainerror.NewValidation("platformk8s/agentexecution: model override is not supported by remote registry")
	}
	if err := modelv1.ValidateRef(ref); err != nil {
		return nil, err
	}
	definitions, err := r.definitions(ctx)
	if err != nil {
		return nil, err
	}
	var match *modelv1.ModelDefinition
	for _, definition := range definitions {
		if definition == nil {
			continue
		}
		if strings.TrimSpace(definition.GetModelId()) != strings.TrimSpace(ref.GetModelId()) {
			continue
		}
		if strings.TrimSpace(ref.GetVendorId()) != "" && strings.TrimSpace(definition.GetVendorId()) != strings.TrimSpace(ref.GetVendorId()) {
			continue
		}
		if match != nil {
			return nil, domainerror.NewValidation("platformk8s/agentexecution: duplicate model definition identity %q/%q", ref.GetVendorId(), ref.GetModelId())
		}
		match = definition
	}
	if match == nil {
		return nil, domainerror.NewNotFound("platformk8s/agentexecution: model definition %q/%q not found", ref.GetVendorId(), ref.GetModelId())
	}
	effective := proto.Clone(match).(*modelv1.ModelDefinition)
	resolved := &modelv1.ResolvedModel{
		ModelId:             effective.GetModelId(),
		EffectiveDefinition: effective,
	}
	if err := modelv1.ValidateResolvedModel(resolved); err != nil {
		return nil, domainerror.NewValidation("platformk8s/agentexecution: resolved model %q is invalid: %v", resolved.GetModelId(), err)
	}
	return resolved, nil
}

func (r *RemoteModelRegistry) definitions(ctx context.Context) ([]*modelv1.ModelDefinition, error) {
	var out []*modelv1.ModelDefinition
	pageToken := ""
	for {
		response, err := r.client.ListModelDefinitions(ctx, &modelservicev1.ListModelDefinitionsRequest{
			PageSize:  modelRegistryPageSize,
			PageToken: pageToken,
		})
		if err != nil {
			return nil, err
		}
		for _, item := range response.GetItems() {
			if item.GetDefinition() != nil {
				out = append(out, item.GetDefinition())
			}
		}
		pageToken = strings.TrimSpace(response.GetNextPageToken())
		if pageToken == "" {
			return out, nil
		}
	}
}

func resolveDefinitionRef(definitions []*modelv1.ModelDefinition, value string, matchAlias bool) (*modelv1.ModelRef, error) {
	var match *modelv1.ModelDefinition
	for _, definition := range definitions {
		if definition == nil {
			continue
		}
		matched := strings.TrimSpace(definition.GetModelId()) == value
		if matchAlias {
			matched = hasAlias(definition, value)
		}
		if !matched {
			continue
		}
		if match != nil {
			return nil, domainerror.NewValidation("platformk8s/agentexecution: model id or alias %q is ambiguous", value)
		}
		match = definition
	}
	if match == nil {
		if matchAlias {
			return nil, domainerror.NewNotFound("platformk8s/agentexecution: model id or alias %q not found", value)
		}
		return nil, nil
	}
	return &modelv1.ModelRef{
		VendorId: strings.TrimSpace(match.GetVendorId()),
		ModelId:  strings.TrimSpace(match.GetModelId()),
	}, nil
}

func hasAlias(definition *modelv1.ModelDefinition, alias string) bool {
	for _, item := range definition.GetAliases() {
		if strings.TrimSpace(item.GetValue()) == strings.TrimSpace(alias) {
			return true
		}
	}
	return false
}
