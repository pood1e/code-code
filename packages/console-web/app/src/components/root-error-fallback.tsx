import type { FallbackProps } from "react-error-boundary";
import { Button, Text } from "@radix-ui/themes";
import { ErrorIcon, StatusCallout, requestErrorMessage } from "@code-code/console-web-ui";

export function RootErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <StatusCallout color="red" role="alert" size="2" icon={<ErrorIcon />}>
      <Text as="div" weight="bold" size="3" mb="1">
        Something went wrong
      </Text>
      <Text as="div" size="2" mb="3">
        {requestErrorMessage(error, "Unknown error occurred")}
      </Text>
      <Button size="1" color="red" variant="soft" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </StatusCallout>
  );
}
