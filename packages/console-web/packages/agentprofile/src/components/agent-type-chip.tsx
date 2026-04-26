import { Avatar, Flex, Text } from "@radix-ui/themes";

type AgentTypeChipProps = {
  agentType: string;
  iconUrl?: string;
};

export function AgentTypeChip({ agentType, iconUrl }: AgentTypeChipProps) {
  return (
    <Flex align="center" gap="2">
      <AgentTypeMark agentType={agentType} iconUrl={iconUrl} />
      <Text size="2" weight="medium">
        {agentType}
      </Text>
    </Flex>
  );
}

export function AgentTypeMark({ agentType, iconUrl }: AgentTypeChipProps) {
  const fallback = agentType
    .split(" ", 1)[0]
    ?.slice(0, 2)
    .toUpperCase() || "CL";
  return <Avatar size="2" src={iconUrl} fallback={fallback} radius="medium" />;
}
