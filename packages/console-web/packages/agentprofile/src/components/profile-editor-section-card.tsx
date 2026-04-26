import { Card, Flex, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

export function ProfileEditorSectionCard({ title, children }: Props) {
  return (
    <Card size="1">
      <Flex direction="column" gap="3">
        <Text size="2" weight="medium">
          {title}
        </Text>
        {children}
      </Flex>
    </Card>
  );
}
