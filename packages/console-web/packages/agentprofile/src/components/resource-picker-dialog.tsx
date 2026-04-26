import { useMemo, useState } from "react";
import { Box, Card, Dialog, Flex, Grid, Text } from "@radix-ui/themes";
import { ActionIconButton, NoDataCallout, SearchTextField } from "@code-code/console-web-ui";
import { PlusIcon } from "./action-icons";

type PickerItem = {
  id: string;
  name: string;
  meta: string;
};

type ResourcePickerDialogProps = {
  title: string;
  open: boolean;
  items: PickerItem[];
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
};

export function ResourcePickerDialog({
  title,
  open,
  items,
  onOpenChange,
  onSelect
}: ResourcePickerDialogProps) {
  const [query, setQuery] = useState("");
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery === "") {
      return items;
    }
    return items.filter((item) => `${item.name} ${item.meta}`.toLowerCase().includes(normalizedQuery));
  }, [items, query]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content maxWidth="680px">
        <Dialog.Title>{title}</Dialog.Title>
        <Box mt="4" mb="4" maxWidth="280px">
          <SearchTextField
            ariaLabel="Search resources"
            value={query}
            placeholder="Search resources"
            onValueChange={setQuery}
          />
        </Box>

        {visibleItems.length === 0 ? (
          <NoDataCallout size="2">
            No matching resources.
          </NoDataCallout>
        ) : (
          <Grid columns={{ initial: "1", md: "2" }} gap="3">
            {visibleItems.map((item) => (
              <Card key={item.id} size="1">
                <Flex direction="column" gap="3">
                  <div>
                    <Text size="2" weight="medium">
                      {item.name}
                    </Text>
                    <Text size="1" color="gray">
                      {item.meta}
                    </Text>
                  </div>
                  <Flex justify="end">
                    <ActionIconButton
                      size="1"
                      aria-label={`Attach ${item.name}`}
                      title={`Attach ${item.name}`}
                      onClick={() => onSelect(item.id)}
                    >
                      <PlusIcon />
                    </ActionIconButton>
                  </Flex>
                </Flex>
              </Card>
            ))}
          </Grid>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
