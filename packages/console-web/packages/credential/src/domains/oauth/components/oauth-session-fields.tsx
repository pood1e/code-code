import { Controller, useFormContext } from "react-hook-form";
import type { CLI } from "@code-code/agent-contract/platform/support/v1";
import { OAuthAuthorizationFlow } from "@code-code/agent-contract/credential/v1";
import {
  FormField,
  FormSelectField,
  FormTextField,
} from "@code-code/console-web-ui";
import { Flex, Text } from "@radix-ui/themes";
import type { OAuthCLIId } from "../api";

export type OAuthSessionFormValues = {
  cliId: OAuthCLIId;
  targetDisplayName: string;
};

type OAuthSessionFieldsProps = {
  clis: CLI[];
  lockedCliId?: OAuthCLIId;
};

export function OAuthSessionFields({ clis, lockedCliId }: OAuthSessionFieldsProps) {
  const {
    control,
    register,
    formState: { errors }
  } = useFormContext<OAuthSessionFormValues>();
  const lockedCLI = clis.find((item) => item.cliId === lockedCliId);

  return (
    <Flex direction="column" gap="3">
      {lockedCLI ? (
        <FormField label="CLI">
          <Text>{oauthCLIOptionLabel(lockedCLI)}</Text>
        </FormField>
      ) : (
        <Controller
          name="cliId"
          control={control}
          render={({ field }) => (
            <FormSelectField
              label="CLI"
              value={field.value}
              items={clis.map((item) => ({
                value: item.cliId,
                label: oauthCLIOptionLabel(item),
              }))}
              onValueChange={field.onChange}
            />
          )}
        />
      )}

      <FormTextField
        label="Display Name"
        error={errors.targetDisplayName ? errors.targetDisplayName.message : null}
        placeholder="e.g. Codex Main"
        inputProps={register("targetDisplayName", { required: "Display name is required" })}
      />
    </Flex>
  );
}

function oauthCLIOptionLabel(cli: CLI) {
  const oauth = cli.oauth;
  if (!oauth) {
    return cli.displayName;
  }
  const flowLabel = oauth.flow === OAuthAuthorizationFlow.DEVICE ? "Device Flow" : "Code Flow";
  if (oauth.recommended) {
    return `${cli.displayName} (Recommended · ${flowLabel})`;
  }
  return `${cli.displayName} (${flowLabel})`;
}
