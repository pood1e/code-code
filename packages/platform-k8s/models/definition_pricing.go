package models

import modelservicev1 "code-code.internal/go-contract/platform/model/v1"

func protoDefinitionPricing(pricing *definitionSourcePricing) *modelservicev1.RegistryModelPricing {
	pricing = normalizeDefinitionSourcePricing(pricing)
	if pricing == nil {
		return nil
	}
	return &modelservicev1.RegistryModelPricing{
		Input:           pricing.Input,
		Output:          pricing.Output,
		CacheReadInput:  pricing.CacheReadInput,
		CacheWriteInput: pricing.CacheWriteInput,
	}
}
