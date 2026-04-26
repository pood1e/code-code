import type { ReactNode } from "react";
import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import { AsyncState, ErrorCallout, NoDataCallout } from "@code-code/console-web-ui";

type OverviewAsyncCardProps = {
  title: string;
  description: string;
  isLoading: boolean;
  isError: boolean;
  errorMessage: ReactNode;
  isEmpty: boolean;
  emptyMessage: ReactNode;
  loadingContent: ReactNode;
  children: ReactNode;
};

export function OverviewAsyncCard({
  title,
  description,
  isLoading,
  isError,
  errorMessage,
  isEmpty,
  emptyMessage,
  loadingContent,
  children,
}: OverviewAsyncCardProps) {
  return (
    <Card size="2" variant="classic">
      <Flex direction="column" gap="4">
        <Flex direction="column" gap="1">
          <Heading size="3" weight="medium">{title}</Heading>
          <Text size="1" color="gray">{description}</Text>
        </Flex>
        <AsyncState
          loading={isLoading}
          loadingContent={loadingContent}
          error={isError ? new Error("Overview card failed to load.") : undefined}
          errorContent={<ErrorCallout>{errorMessage}</ErrorCallout>}
          isEmpty={isEmpty}
          emptyContent={<NoDataCallout size="2">{emptyMessage}</NoDataCallout>}
        >
          {children}
        </AsyncState>
      </Flex>
    </Card>
  );
}
