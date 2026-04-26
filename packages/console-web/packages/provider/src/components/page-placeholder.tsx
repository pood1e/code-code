import { Card, Text } from "@radix-ui/themes";

type PagePlaceholderProps = {
  message: string;
};

export function PagePlaceholder({ message }: PagePlaceholderProps) {
  return (
    <Card size="2" variant="classic">
      <Text size="2" color="gray">{message}</Text>
    </Card>
  );
}
