import { useEffect, useState } from 'react';

export function useThreadComposerConfigState({
  initialAdditionalValues,
  initialRuntimeValues,
  onAdditionalValueChange,
  onRuntimeValueChange
}: {
  initialAdditionalValues: Record<string, unknown>;
  initialRuntimeValues: Record<string, unknown>;
  onAdditionalValueChange: (fieldName: string, value: unknown) => void;
  onRuntimeValueChange: (fieldName: string, value: unknown) => void;
}) {
  const [additionalValues, setAdditionalValues] = useState(
    initialAdditionalValues
  );
  const [runtimeValues, setRuntimeValues] = useState(initialRuntimeValues);

  useEffect(() => {
    setAdditionalValues(initialAdditionalValues);
  }, [initialAdditionalValues]);

  useEffect(() => {
    setRuntimeValues(initialRuntimeValues);
  }, [initialRuntimeValues]);

  return {
    additionalValues,
    runtimeValues,
    handleAdditionalValueChange: (fieldName: string, value: unknown) => {
      setAdditionalValues((current) => ({
        ...current,
        [fieldName]: value
      }));
      onAdditionalValueChange(fieldName, value);
    },
    handleRuntimeValueChange: (fieldName: string, value: unknown) => {
      setRuntimeValues((current) => ({
        ...current,
        [fieldName]: value
      }));
      onRuntimeValueChange(fieldName, value);
    }
  };
}
