import type { ReactNode } from "react";
import { Button, Card, Flex, Skeleton, Text } from "@radix-ui/themes";
import { requestErrorMessage } from "./request-error";
import { StatusCallout } from "./status-callout";

type AsyncStateProps = {
  children: ReactNode;
  emptyDescription?: string;
  emptyTitle?: string;
  emptyContent?: ReactNode;
  error?: unknown;
  errorContent?: ReactNode;
  errorDescription?: string;
  errorTitle?: string;
  loadingContent?: ReactNode;
  loadingCard?: boolean;
  isEmpty?: boolean;
  loading?: boolean;
  onRetry?: () => void;
};

function LoadingState({ card = false }: { card?: boolean }) {
  const content = (
    <Flex direction="column" gap="3" p="4">
      <Skeleton height="20px" />
      <Skeleton height="20px" />
      <Skeleton height="20px" width="60%" />
    </Flex>
  );

  if (card) {
    return <Card size="2" variant="classic">{content}</Card>;
  }

  return content;
}

export function AsyncState({
  children,
  emptyDescription,
  emptyTitle = "No data found.",
  emptyContent,
  error,
  errorContent,
  errorDescription,
  errorTitle = "Failed to load data.",
  loadingCard = false,
  loadingContent,
  isEmpty = false,
  loading = false,
  onRetry
}: AsyncStateProps) {
  if (loading) {
    if (loadingContent) {
      return <>{loadingContent}</>;
    }
    return <LoadingState card={loadingCard} />;
  }

  if (error) {
    if (errorContent) {
      return <>{errorContent}</>;
    }
    return (
      <Flex align="center" justify="center" p="6" direction="column" gap="3">
        <StatusCallout size="2" role="alert">
          <Text size="3" mb="1">
            {errorTitle}
          </Text>
          <Text size="2" color="gray" mb="3">
            {errorDescription || requestErrorMessage(error, "Unknown error occurred.")}
          </Text>
          {onRetry ? <Button variant="soft" color="gray" size="2" onClick={onRetry}>Retry</Button> : null}
        </StatusCallout>
      </Flex>
    );
  }

  if (isEmpty) {
    if (emptyContent) {
      return <>{emptyContent}</>;
    }
    return (
      <Flex align="center" justify="center" p="8" direction="column" gap="2">
        <Text weight="medium">{emptyTitle}</Text>
        {emptyDescription ? <Text size="2" color="gray">{emptyDescription}</Text> : null}
      </Flex>
    );
  }

  return <>{children}</>;
}
