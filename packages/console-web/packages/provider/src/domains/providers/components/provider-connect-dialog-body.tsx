import type { OAuthCallbackDelivery } from "@code-code/agent-contract/platform/support/v1";
import type { ProviderConnectSessionView } from "@code-code/agent-contract/platform/management/v1";
import { AsyncState, NoDataCallout, requestErrorMessage } from "@code-code/console-web-ui";
import { FormProvider, type UseFormReturn } from "react-hook-form";
import type {
  ProviderConnectDialogCopy,
  ProviderConnectDialogOption,
} from "../provider-connect-dialog-model";
import type { ProviderConnectFormValues } from "../provider-connect-form-model";
import { ProviderConnectForm } from "./provider-connect-form";
import { ProviderConnectSessionCard } from "./provider-connect-session-card";

type Props = {
  isLoading: boolean;
  optionsError: unknown;
  onRetry: () => void;
  copy: ProviderConnectDialogCopy;
  scopedConnectOptions: ProviderConnectDialogOption[];
  sessionId: string;
  session?: ProviderConnectSessionView;
  isSessionLoading: boolean;
  sessionError: unknown;
  sessionCallbackDelivery?: OAuthCallbackDelivery;
  onSessionCallbackSubmitted: () => Promise<void>;
  onOpenAuthorization: () => void;
  onSessionRetry: () => void;
  selectedOption?: ProviderConnectDialogOption;
  submitError: string;
  methods: UseFormReturn<ProviderConnectFormValues>;
  onFormSubmit: () => void;
  onConnectOptionChange: (connectOptionId: string) => void;
  onCancel: () => void;
};

export function ProviderConnectDialogBody({
  isLoading,
  optionsError,
  onRetry,
  copy,
  scopedConnectOptions,
  sessionId,
  session,
  isSessionLoading,
  sessionError,
  sessionCallbackDelivery,
  onSessionCallbackSubmitted,
  onOpenAuthorization,
  onSessionRetry,
  selectedOption,
  submitError,
  methods,
  onFormSubmit,
  onConnectOptionChange,
  onCancel,
}: Props) {
  return (
    <AsyncState loading={isLoading} error={optionsError} onRetry={onRetry}>
      {scopedConnectOptions.length === 0 ? (
        <div style={{ marginTop: "var(--space-3)" }}>
          <NoDataCallout>No options.</NoDataCallout>
        </div>
      ) : sessionId ? (
        <ProviderConnectSessionCard
          session={session}
          isLoading={isSessionLoading}
          errorMessage={requestErrorMessage(sessionError, "")}
          callbackDelivery={sessionCallbackDelivery}
          onCallbackSubmitted={onSessionCallbackSubmitted}
          onOpenAuthorization={onOpenAuthorization}
          onRetry={onSessionRetry}
        />
      ) : (
        <FormProvider {...methods}>
          <ProviderConnectForm
            connectOptions={scopedConnectOptions}
            selectedOption={selectedOption}
            connectOptionLabel={copy.selectLabel}
            showConnectOptionSelector={scopedConnectOptions.length > 1}
            methods={methods}
            submitError={submitError}
            onSubmit={onFormSubmit}
            onConnectOptionChange={onConnectOptionChange}
            onCancel={onCancel}
          />
        </FormProvider>
      )}
    </AsyncState>
  );
}
