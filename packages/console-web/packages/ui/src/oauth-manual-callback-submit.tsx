import { useState } from "react";
import { Box, Button, Flex, Text, TextArea } from "@radix-ui/themes";
import { FormFieldError } from "./form-field-error";
import { requestErrorMessage as formatRequestError } from "./request-error";

type OAuthManualCallbackSubmitProps = {
  canSubmit: boolean;
  onSubmitCallback: (callbackInput: string) => Promise<void> | void;
  onSubmitted?: () => Promise<void> | void;
  helpText?: string;
  placeholder?: string;
  submitLabel?: string;
  failureMessage?: string;
  disabled?: boolean;
};

const defaultHelpText = "Local callback listener is optional. Paste the final callback URL and submit it directly.";
const defaultPlaceholder = "http://localhost:1455/auth/callback?code=...&state=...";
const defaultSubmitLabel = "Submit Callback URL";

export function OAuthManualCallbackSubmit({
  canSubmit,
  onSubmitCallback,
  onSubmitted,
  helpText = defaultHelpText,
  placeholder = defaultPlaceholder,
  submitLabel = defaultSubmitLabel,
  failureMessage = "Failed to submit callback URL.",
  disabled = false,
}: OAuthManualCallbackSubmitProps) {
  const [manualCallbackInput, setManualCallbackInput] = useState("");
  const [manualSubmitError, setManualSubmitError] = useState("");
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);

  if (!canSubmit) {
    return null;
  }

  return (
    <Box>
      <Text size="1" color="gray">{helpText}</Text>
      <TextArea
        value={manualCallbackInput}
        onChange={(event) => {
          setManualSubmitError("");
          setManualCallbackInput(event.currentTarget.value);
        }}
        rows={3}
        mt="2"
        placeholder={placeholder}
      />
      <FormFieldError mt="1">{manualSubmitError}</FormFieldError>
      <Flex justify="end" mt="2">
        <Button
          type="button"
          onClick={async () => {
            if (disabled || !manualCallbackInput.trim()) {
              return;
            }
            setIsSubmittingCallback(true);
            setManualSubmitError("");
            try {
              await onSubmitCallback(manualCallbackInput.trim());
              await onSubmitted?.();
              setManualCallbackInput("");
            } catch (error: unknown) {
              setManualSubmitError(formatRequestError(error, failureMessage));
            } finally {
              setIsSubmittingCallback(false);
            }
          }}
          loading={isSubmittingCallback}
          disabled={disabled || !manualCallbackInput.trim()}
        >
          {submitLabel}
        </Button>
      </Flex>
    </Box>
  );
}
