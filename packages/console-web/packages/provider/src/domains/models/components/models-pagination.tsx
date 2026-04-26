import { Button, Flex, Text } from "@radix-ui/themes";

type ModelsPaginationProps = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNext: () => void;
  onPrevious: () => void;
  page: number;
  totalPages?: number;
};

export function ModelsPagination({
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  page,
  totalPages
}: ModelsPaginationProps) {
  if (!hasNextPage && !hasPreviousPage) return null;

  return (
    <Flex align="center" justify="between" gap="3" p="4">
      <Text size="1" color="gray">
        {totalPages && totalPages > 0 ? `Page ${page} / ${totalPages}` : `Page ${page}`}
      </Text>
      <Flex gap="2">
        <Button variant="soft" color="gray" disabled={!hasPreviousPage} onClick={onPrevious}>
          Previous
        </Button>
        <Button variant="soft" color="gray" disabled={!hasNextPage} onClick={onNext}>
          Next
        </Button>
      </Flex>
    </Flex>
  );
}
