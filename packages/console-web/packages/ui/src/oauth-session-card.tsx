import type { ReactNode, ComponentProps } from "react";
import { Button, Card, Code, Flex, Spinner, Text } from "@radix-ui/themes";
import { OAuthManualCallbackSubmit } from "./oauth-manual-callback-submit";
import { StatusCallout } from "./status-callout";

type ActionButtonProps = {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: ComponentProps<typeof Button>["variant"];
  color?: ComponentProps<typeof Button>["color"];
};

type ManualCallbackProps = {
  canSubmit: boolean;
  onSubmitCallback: (callbackInput: string) => Promise<void> | void;
  onSubmitted?: () => Promise<void> | void;
  disabled?: boolean;
  helpText?: string;
  placeholder?: string;
  submitLabel?: string;
  failureMessage?: string;
};

type OAuthSessionCardProps = {
  statusColor: "gray" | "red" | "amber" | "green" | "blue";
  statusMessage: string;
  statusSize?: "1" | "2";
  header?: ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  hint?: ReactNode;
  userCode?: string;
  userCodeLabel?: string;
  children?: ReactNode;
  onOpenAuthorization?: () => void;
  openAuthorizationLabel?: string;
  primaryAction?: ActionButtonProps;
  openAuthorizationVariant?: ComponentProps<typeof Button>["variant"];
  openAuthorizationColor?: ComponentProps<typeof Button>["color"];
  manualCallback?: ManualCallbackProps;
  footer?: ReactNode;
  gap?: string;
};

export function OAuthSessionCard({
  statusColor,
  statusMessage,
  statusSize = "2",
  header,
  isLoading = false,
  loadingText = "Checking current session state…",
  hint,
  userCode,
  userCodeLabel = "User Code",
  children,
  onOpenAuthorization,
  openAuthorizationLabel = "Open Authorization",
  openAuthorizationVariant,
  openAuthorizationColor,
  primaryAction,
  manualCallback,
  footer,
  gap = "3",
}: OAuthSessionCardProps) {
  const hasSecondaryAction = Boolean(onOpenAuthorization);
  const hasPrimaryAction = Boolean(primaryAction);
  const showActions = hasSecondaryAction || hasPrimaryAction;

  const manualCallbackNode = manualCallback ? (
    <OAuthManualCallbackSubmit
      canSubmit={manualCallback.canSubmit}
      onSubmitCallback={manualCallback.onSubmitCallback}
      onSubmitted={manualCallback.onSubmitted}
      disabled={manualCallback.disabled}
      helpText={manualCallback.helpText}
      placeholder={manualCallback.placeholder}
      submitLabel={manualCallback.submitLabel}
      failureMessage={manualCallback.failureMessage}
    />
  ) : null;

  const inlineActions = showActions ? (
    <Flex
      justify={hasSecondaryAction && hasPrimaryAction ? "between" : "end"}
      align="center"
      gap="2"
    >
      {primaryAction ? (
        <Button
          type={primaryAction.type ?? "button"}
          variant={primaryAction.variant ?? "soft"}
          color={primaryAction.color ?? "gray"}
          loading={primaryAction.loading}
          disabled={primaryAction.disabled}
          onClick={primaryAction.onClick}
        >
          {primaryAction.label}
        </Button>
      ) : null}
      {onOpenAuthorization ? (
        <Button
          type="button"
          variant={openAuthorizationVariant}
          color={openAuthorizationColor}
          onClick={onOpenAuthorization}
        >
          {openAuthorizationLabel}
        </Button>
      ) : null}
    </Flex>
  ) : null;

  return (
    <Flex direction="column" gap={gap}>
      {header}
      <StatusCallout color={statusColor} size={statusSize}>
        {statusMessage}
      </StatusCallout>
      {isLoading ? (
        <Flex align="center" gap="2">
          <Spinner size="2" />
          <Text size="1" color="gray">
            {loadingText}
          </Text>
        </Flex>
      ) : null}
      {hint ? <Text size="1" color="gray">{hint}</Text> : null}
      {children}
      {manualCallbackNode}
      {userCode ? (
        <Card variant="surface" size="1">
          <Text size="1" color="gray">{userCodeLabel}</Text>
          <Code size="3" mt="1">{userCode}</Code>
        </Card>
      ) : null}
      {inlineActions}
      {footer}
    </Flex>
  );
}

export type { OAuthSessionCardProps };
