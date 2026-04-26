import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { startTransition } from "react";
import { OAuthAuthorizationFlow } from "@code-code/agent-contract/credential/v1";
import { Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { useNavigate } from "react-router-dom";
import { DialogFooterActions, ErrorCalloutIf, openExternalUrl, requestErrorMessage } from "@code-code/console-web-ui";
import { buildCredentialId } from "../../credentials/credential-id";
import {
  listOAuthCLIs,
  useProviderCLIs
} from "../../credentials/reference-data";
import {
  startOAuthSession,
  type OAuthCLIId
} from "../api";
import { OAuthSessionFields, type OAuthSessionFormValues } from "./oauth-session-fields";

type OAuthSessionDialogProps = {
  lockedCliId?: OAuthCLIId;
  title?: string;
  triggerLabel?: string;
};

export function OAuthSessionDialog({
  lockedCliId,
  title = "Connect OAuth Credential",
  triggerLabel = "Connect OAuth"
}: OAuthSessionDialogProps) {
  const navigate = useNavigate();
  const { clis } = useProviderCLIs();
  const oauthCLIs = listOAuthCLIs(clis);
  const [open, setOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const defaultCliId = lockedCliId || getPreferredCliId(oauthCLIs) || "";
  const methods = useForm<OAuthSessionFormValues>({
    defaultValues: { cliId: defaultCliId, targetDisplayName: "" }
  });
  const { handleSubmit, reset, setValue, watch } = methods;
  const cliId = watch("cliId");

  useEffect(() => {
    if (lockedCliId) {
      setValue("cliId", lockedCliId);
      return;
    }
    if (!cliId && defaultCliId) {
      setValue("cliId", defaultCliId);
    }
  }, [cliId, defaultCliId, lockedCliId, setValue]);

  const onSubmit = handleSubmit(async (data) => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const cli = oauthCLIs.find((item) => item.cliId === data.cliId);
      const flow = cli?.oauth?.flow || OAuthAuthorizationFlow.UNSPECIFIED;
      if (!cli || flow === OAuthAuthorizationFlow.UNSPECIFIED) {
        throw new Error(`Unsupported OAuth CLI: ${data.cliId}`);
      }
      const session = await startOAuthSession({
        cliId: data.cliId,
        flow,
        targetCredentialId: buildCredentialId(data.targetDisplayName),
        targetDisplayName: data.targetDisplayName
      });
      setOpen(false);
      reset();
      const authorizationURL = session.status?.authorizationUrl?.trim() || "";
      if (!authorizationURL) throw new Error("OAuth authorization URL is missing");
      openExternalUrl(authorizationURL);
      startTransition(() => navigate(`/provider-credentials/oauth/callback?sessionId=${session.spec?.sessionId || ""}`));
    } catch (error: unknown) {
      setErrorMsg(requestErrorMessage(error, "Failed to start OAuth authorization"));
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      reset({ cliId: defaultCliId, targetDisplayName: "" });
      setErrorMsg("");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger><Button size="2" variant="soft">{triggerLabel}</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="460px" aria-describedby={undefined}>
        <Dialog.Title>{title}</Dialog.Title>
        <Text size="1" color="gray">Start one typed authorization session and let the control plane import the credential.</Text>
        <ErrorCalloutIf error={errorMsg} mt="4" />
        <FormProvider {...methods}>
          <form onSubmit={onSubmit}>
            <Flex direction="column" gap="4" mt="4">
          <OAuthSessionFields clis={oauthCLIs} lockedCliId={lockedCliId} />
              <DialogFooterActions
                isSubmitting={isSubmitting}
                submitText="Continue"
                submitDisabled={!oauthCLIs.length}
              />
            </Flex>
          </form>
        </FormProvider>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function getPreferredCliId(clis: { cliId: string; oauth?: { recommended: boolean } }[]) {
  return clis.find((item) => item.oauth?.recommended)?.cliId
    || clis[0]?.cliId
    || "";
}
