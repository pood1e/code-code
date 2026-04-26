export type SourceFilterOption = {
  label: string;
  value: string;
};

const defaultSourceFilterOptions: readonly RegisteredSourceFilterOption[] = [
  { value: "github-models", label: "GitHub Models", order: 100 },
  { value: "cerebras", label: "Cerebras", order: 200 },
  { value: "modelscope", label: "ModelScope", order: 300 },
  { value: "nvidia-integrate", label: "NVIDIA Integrate", order: 400 },
  { value: "huggingface-hub", label: "Hugging Face Hub", order: 500 },
  { value: "openrouter", label: "OpenRouter", order: 600 },
];

type RegisteredSourceFilterOption = SourceFilterOption & {
  order: number;
};

const sourceFilterOptionRegistry = new Map<string, RegisteredSourceFilterOption>();
let orderedSourceFilterOptions: SourceFilterOption[] | null = null;

export function registerSourceFilterOption(option: RegisteredSourceFilterOption) {
  if (sourceFilterOptionRegistry.has(option.value)) {
    return;
  }
  sourceFilterOptionRegistry.set(option.value, option);
  orderedSourceFilterOptions = null;
}

export function registerSourceFilterOptions(options: readonly RegisteredSourceFilterOption[]) {
  for (const option of options) {
    registerSourceFilterOption(option);
  }
}

export function registerDefaultSourceFilterOptions() {
  registerSourceFilterOptions(defaultSourceFilterOptions);
}

export function listRegisteredSourceFilterOptions(): SourceFilterOption[] {
  if (!orderedSourceFilterOptions) {
    orderedSourceFilterOptions = [...sourceFilterOptionRegistry.values()]
      .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
      .map(({ label, value }) => ({ label, value }));
  }
  return orderedSourceFilterOptions;
}

export function registeredSourceFilterOptionLabel(sourceId: string): string {
  return sourceFilterOptionRegistry.get(sourceId)?.label || sourceId;
}
