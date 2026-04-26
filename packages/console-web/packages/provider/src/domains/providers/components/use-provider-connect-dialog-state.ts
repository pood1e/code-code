import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { ProviderConnectDialogModel, ProviderConnectDialogOption } from "../provider-connect-dialog-model";
import {
  defaultProviderConnectFormValues,
  type ProviderConnectFormValues,
} from "../provider-connect-form-model";

type Params = {
  connectSessionId?: string;
  open: boolean;
  methods: UseFormReturn<ProviderConnectFormValues>;
  dialogModel: ProviderConnectDialogModel;
  preferredOption?: ProviderConnectDialogOption;
  scopedConnectOptions: ProviderConnectDialogOption[];
};

export function useProviderConnectDialogState({
  connectSessionId,
  open,
  methods,
  dialogModel,
  preferredOption,
  scopedConnectOptions,
}: Params) {
  const [localSessionId, setLocalSessionId] = useState(connectSessionId ?? "");
  const [submitError, setSubmitError] = useState("");

  const selectedOption = dialogModel.selectedOption(methods.watch("connectOptionId"));

  useEffect(() => {
    setLocalSessionId(connectSessionId ?? "");
  }, [connectSessionId]);

  useEffect(() => {
    if (!open || scopedConnectOptions.length === 0 || localSessionId) {
      return;
    }
    const current = methods.getValues("connectOptionId");
    if (current && dialogModel.option(current)) {
      return;
    }
    methods.reset(defaultProviderConnectFormValues(preferredOption));
  }, [dialogModel, localSessionId, methods, open, preferredOption, scopedConnectOptions.length]);

  return {
    localSessionId,
    setLocalSessionId,
    submitError,
    setSubmitError,
    selectedOption,
  };
}
