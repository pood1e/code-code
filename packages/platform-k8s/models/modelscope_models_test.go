package models

import "testing"

func TestNormalizeModelScopeDefinitionsMapsStableFamiliesAndPresetVendors(t *testing.T) {
	t.Parallel()

	definitions := normalizeModelScopeDefinitions([]modelScopeModel{
		{ID: "Qwen/Qwen3-235B-A22B-Instruct-2507"},
		{ID: "meituan-longcat/LongCat-Flash-Lite"},
		{ID: "Shanghai_AI_Laboratory/Intern-S1"},
	}, testConfiguredVendorScope(map[string][]string{
		"qwen":                   nil,
		"meituan-longcat":        nil,
		"shanghai-ai-laboratory": nil,
		"modelscope":             nil,
	}), nil, "modelscope")

	if got, want := len(definitions["qwen"]), 1; got != want {
		t.Fatalf("len(qwen) = %d, want %d", got, want)
	}
	if got, want := definitions["qwen"][0].definition.GetModelId(), "qwen3-235b-a22b-instruct"; got != want {
		t.Fatalf("qwen model id = %q, want %q", got, want)
	}
	if got, want := len(definitions["modelscope"]), 3; got != want {
		t.Fatalf("len(modelscope) = %d, want %d", got, want)
	}
	qwen := mustFindCollectedDefinition(t, definitions["modelscope"], "Qwen/Qwen3-235B-A22B-Instruct-2507")
	if got, want := qwen.definition.GetVendorId(), "modelscope"; got != want {
		t.Fatalf("qwen proxy vendor id = %q, want %q", got, want)
	}
	if qwen.sourceRef == nil {
		t.Fatal("qwen proxy sourceRef = nil")
	}
	if got, want := qwen.sourceRef.GetVendorId(), "qwen"; got != want {
		t.Fatalf("qwen proxy sourceRef.vendorId = %q, want %q", got, want)
	}
	if got, want := qwen.sourceRef.GetModelId(), "qwen3-235b-a22b-instruct"; got != want {
		t.Fatalf("qwen proxy sourceRef.modelId = %q, want %q", got, want)
	}
	longcat := mustFindCollectedDefinition(t, definitions["modelscope"], "meituan-longcat/LongCat-Flash-Lite")
	if longcat.sourceRef == nil {
		t.Fatal("longcat proxy sourceRef = nil")
	}
	if got, want := longcat.sources[0].aliasID, SourceIDModelScope; got != want {
		t.Fatalf("source id = %q, want %q", got, want)
	}
}

func TestNormalizeModelScopeDefinitionsInfersActualVendorForUploaderOwners(t *testing.T) {
	t.Parallel()

	definitions := normalizeModelScopeDefinitions([]modelScopeModel{
		{ID: "LLM-Research/c4ai-command-r-plus-08-2024"},
		{ID: "LLM-Research/Llama-4-Maverick-17B-128E-Instruct"},
		{ID: "iic/GUI-Owl-1.5-8B-Instruct"},
		{ID: "MusePublic/Qwen-Image-Edit"},
		{ID: "OpenGVLab/InternVL3_5-241B-A28B"},
		{ID: "opencompass/CompassJudger-1-32B-Instruct"},
		{ID: "XGenerationLab/XiYanSQL-QwenCoder-32B-2504"},
		{ID: "PaddlePaddle/ERNIE-4.5-300B-A47B-PT"},
		{ID: "XiaomiMiMo/MiMo-V2-Flash"},
	}, testConfiguredVendorScope(map[string][]string{
		"cohere":         nil,
		"meta":           nil,
		"modelscope":     nil,
		"opencompass":    {"open-compass"},
		"opengvlab":      nil,
		"paddlepaddle":   nil,
		"qwen":           nil,
		"tongyi-lab":     {"iic"},
		"xgenerationlab": nil,
		"xiaomi":         {"XiaomiMiMo"},
	}), nil, "modelscope")

	if got, want := len(definitions["cohere"]), 1; got != want {
		t.Fatalf("len(cohere) = %d, want %d", got, want)
	}
	if got, want := definitions["cohere"][0].definition.GetModelId(), "c4ai-command-r-plus"; got != want {
		t.Fatalf("cohere model id = %q, want %q", got, want)
	}
	assertProxySourceRef(t, mustFindCollectedDefinition(t, definitions["modelscope"], "LLM-Research/c4ai-command-r-plus-08-2024"), "cohere", "c4ai-command-r-plus")
	assertProxySourceRef(t, mustFindCollectedDefinition(t, definitions["modelscope"], "LLM-Research/Llama-4-Maverick-17B-128E-Instruct"), "meta", "llama-4-maverick-17b-128e-instruct")
	assertProxySourceRef(t, mustFindCollectedDefinition(t, definitions["modelscope"], "iic/GUI-Owl-1.5-8B-Instruct"), "tongyi-lab", "gui-owl-1.5-8b-instruct")
	assertProxySourceRef(t, mustFindCollectedDefinition(t, definitions["modelscope"], "MusePublic/Qwen-Image-Edit"), "qwen", "qwen-image-edit")
	assertProxySourceRef(t, mustFindCollectedDefinition(t, definitions["modelscope"], "OpenGVLab/InternVL3_5-241B-A28B"), "opengvlab", "internvl3-5-241b-a28b")
	assertProxySourceRef(t, mustFindCollectedDefinition(t, definitions["modelscope"], "opencompass/CompassJudger-1-32B-Instruct"), "opencompass", "compassjudger-1-32b-instruct")
	assertProxySourceRef(t, mustFindCollectedDefinition(t, definitions["modelscope"], "XGenerationLab/XiYanSQL-QwenCoder-32B-2504"), "xgenerationlab", "xiyansql-qwencoder-32b")
	assertProxySourceRef(t, mustFindCollectedDefinition(t, definitions["modelscope"], "PaddlePaddle/ERNIE-4.5-300B-A47B-PT"), "paddlepaddle", "ernie-4.5-300b-a47b-pt")
	assertProxySourceRef(t, mustFindCollectedDefinition(t, definitions["modelscope"], "XiaomiMiMo/MiMo-V2-Flash"), "xiaomi", "mimo-v2-flash")
}

func assertProxySourceRef(t *testing.T, item collectedDefinition, vendorID string, modelID string) {
	t.Helper()

	if item.sourceRef == nil {
		t.Fatal("proxy sourceRef = nil")
	}
	if got, want := item.sourceRef.GetVendorId(), vendorID; got != want {
		t.Fatalf("proxy sourceRef.vendorId = %q, want %q", got, want)
	}
	if got, want := item.sourceRef.GetModelId(), modelID; got != want {
		t.Fatalf("proxy sourceRef.modelId = %q, want %q", got, want)
	}
}

func mustFindCollectedDefinition(t *testing.T, items []collectedDefinition, modelID string) collectedDefinition {
	t.Helper()

	for _, item := range items {
		if item.definition.GetModelId() == modelID {
			return item
		}
	}
	t.Fatalf("model %q not found", modelID)
	return collectedDefinition{}
}
