import { Card, Flex, Grid, Text } from "@radix-ui/themes";
import { PlusIcon, PencilIcon, TrashIcon } from "./action-icons";
import { ActionIconButton, ConfirmActionButton, NoDataCallout } from "@code-code/console-web-ui";
import type { ReactNode } from "react";

type ResourceListItem = {
  id: string;
  name: string;
};

type ResourceListSectionProps<T extends ResourceListItem> = {
  title: string;
  emptyText: string;
  items: readonly T[];
  onCreate: () => void;
  onEdit: (item: T) => void | Promise<void>;
  onDelete: (item: T) => void | Promise<void>;
  renderHeaderSuffix?: (item: T) => ReactNode;
  renderBody: (item: T) => ReactNode;
};

export function ResourceListSection<T extends ResourceListItem>({
  title,
  emptyText,
  items,
  onCreate,
  onEdit,
  onDelete,
  renderHeaderSuffix,
  renderBody,
}: ResourceListSectionProps<T>) {
  return (
    <Flex direction="column" gap="4">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Text size="2" weight="medium">
          {title}
        </Text>
        <ActionIconButton aria-label={`Add ${title}`} title={`Add ${title}`} onClick={onCreate}>
          <PlusIcon />
        </ActionIconButton>
      </Flex>

      {items.length === 0 ? (
        <NoDataCallout>{emptyText}</NoDataCallout>
      ) : (
        <Grid columns={{ initial: "1", md: "2", xl: "3" }} gap="3">
          {items.map((item) => (
            <Card key={item.id} size="2">
              <Flex direction="column" gap="3">
                <Flex justify="between" align="start" gap="3">
                  <div>
                    <Text size="2" weight="medium">
                      {item.name}
                    </Text>
                    {renderHeaderSuffix ? (
                      <Flex gap="2" wrap="wrap" mt="2">
                        {renderHeaderSuffix(item)}
                      </Flex>
                    ) : null}
                  </div>
                  <Flex gap="2">
                    <ActionIconButton
                      size="1"
                      variant="soft"
                      color="gray"
                      aria-label={`Edit ${item.name}`}
                      title={`Edit ${item.name}`}
                      onClick={() => { void onEdit(item); }}
                    >
                      <PencilIcon />
                    </ActionIconButton>
                    <ConfirmActionButton
                      title={`Delete ${item.name}`}
                      description={`Delete ${item.name}?`}
                      confirmText="Delete"
                      onConfirm={() => onDelete(item)}
                    >
                      <ActionIconButton
                        size="1"
                        variant="soft"
                        color="gray"
                        aria-label={`Delete ${item.name}`}
                        title={`Delete ${item.name}`}
                      >
                        <TrashIcon />
                      </ActionIconButton>
                    </ConfirmActionButton>
                  </Flex>
                </Flex>
                {renderBody(item)}
              </Flex>
            </Card>
          ))}
        </Grid>
      )}
    </Flex>
  );
}
