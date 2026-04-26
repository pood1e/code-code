import { useMemo, useState } from "react";
import { providerTypeLabel } from "../domain/profile-adapters";
import type { FallbackProviderOption, SelectionFallback } from "../domain/types";

type SelectOption = {
  value: string;
  label: string;
};

type FallbackPickerModel = {
  providerOptions: SelectOption[];
  surfaceOptions: SelectOption[];
  modelSelectOptions: SelectOption[];
  resolvedProviderValue: string;
  resolvedSurfaceValue: string;
  resolvedModelValue: string;
  setProviderValue: (value: string) => void;
  setSurfaceValue: (value: string) => void;
  setModelValue: (value: string) => void;
  selectedModelAvailability?: SelectionFallback["availability"];
  selectedFallback: SelectionFallback | null;
};

export function useFallbackPickerModel(items: FallbackProviderOption[]): FallbackPickerModel {
  const providerOptions = useMemo(
    () => items.map((item) => ({ value: item.id, label: `${item.label} · ${item.vendorLabel}` })),
    [items],
  );
  const [providerValue, setProviderValue] = useState("");
  const resolvedProviderValue = resolveSelectedValue(providerOptions, providerValue);
  const selectedProvider = useMemo(
    () => items.find((item) => item.id === resolvedProviderValue) ?? null,
    [items, resolvedProviderValue],
  );

  const surfaceOptions = useMemo(
    () => (selectedProvider?.surfaces || []).map((item) => ({
      value: item.providerSurfaceBindingId,
      label: `${item.label} · ${providerTypeLabel(item.providerType)}`,
    })),
    [selectedProvider],
  );
  const [surfaceValue, setSurfaceValue] = useState("");
  const resolvedSurfaceValue = resolveSelectedValue(surfaceOptions, surfaceValue);
  const selectedSurface = useMemo(
    () => selectedProvider?.surfaces.find((item) => item.providerSurfaceBindingId === resolvedSurfaceValue) ?? null,
    [resolvedSurfaceValue, selectedProvider],
  );

  const modelOptions = selectedSurface?.models || [];
  const modelSelectOptions = useMemo(
    () => modelOptions.map((item) => ({ value: item.id, label: item.modelId })),
    [modelOptions],
  );
  const [modelValue, setModelValue] = useState("");
  const resolvedModelValue = resolveSelectedValue(modelSelectOptions, modelValue);
  const selectedModel = useMemo(
    () => modelOptions.find((item) => item.id === resolvedModelValue) ?? null,
    [modelOptions, resolvedModelValue],
  );

  const selectedFallback = selectedProvider && selectedSurface && selectedModel
    ? {
        id: selectedModel.id,
        providerSurfaceBindingId: selectedSurface.providerSurfaceBindingId,
        vendorId: selectedProvider.vendorId,
        vendorLabel: selectedProvider.vendorLabel,
        providerLabel: selectedProvider.label,
        providerIconUrl: selectedProvider.iconUrl,
        providerType: selectedSurface.providerType,
        surfaceLabel: selectedSurface.label,
        modelId: selectedModel.modelId,
        availability: selectedModel.availability,
      }
    : null;

  return {
    providerOptions,
    surfaceOptions,
    modelSelectOptions,
    resolvedProviderValue,
    resolvedSurfaceValue,
    resolvedModelValue,
    setProviderValue,
    setSurfaceValue,
    setModelValue,
    selectedModelAvailability: selectedModel?.availability,
    selectedFallback,
  };
}

function resolveSelectedValue(options: SelectOption[], value: string) {
  return options.some((item) => item.value === value) ? value : (options[0]?.value ?? "");
}
