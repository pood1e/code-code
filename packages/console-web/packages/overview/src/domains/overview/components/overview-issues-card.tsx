import { Button, Flex, Skeleton, Text } from "@radix-ui/themes";
import { Link } from "react-router-dom";
import { StatusBadge } from "@code-code/console-web-ui";
import type { OverviewIssue } from "../view";
import { OverviewAsyncCard } from "./overview-async-card";

type Props = {
  issues: OverviewIssue[];
  isLoading: boolean;
  isError: boolean;
};

export function OverviewIssuesCard({ issues, isLoading, isError }: Props) {
  const topIssues = issues.slice(0, 5);
  return (
    <OverviewAsyncCard
      title="Attention"
      description="Top readiness issues across providers and credentials."
      isLoading={isLoading}
      isError={isError}
      errorMessage="Failed to load overview issues."
      isEmpty={topIssues.length === 0}
      emptyMessage="No active readiness issues."
      loadingContent={<OverviewIssuesSkeleton />}
    >
      <Flex direction="column" gap="3">
        {topIssues.map((issue) => (
          <Flex key={`${issue.title}:${issue.reason}`} justify="between" align="start" gap="3">
            <Flex direction="column" gap="1">
              <Flex align="center" gap="2" wrap="wrap">
                <StatusBadge color={issue.level} label={issue.level === "red" ? "Needs Attention" : "Watch"} />
                <Text size="2" weight="medium">{issue.title}</Text>
              </Flex>
              <Text size="1" color="gray">{issue.reason}</Text>
            </Flex>
            {issue.href ? (
              <Button asChild size="1" variant="soft" color={issue.level}>
                <Link to={issue.href}>{issue.actionLabel || "Review"}</Link>
              </Button>
            ) : null}
          </Flex>
        ))}
      </Flex>
    </OverviewAsyncCard>
  );
}

function OverviewIssuesSkeleton() {
  return (
    <Flex direction="column" gap="3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Flex key={index} direction="column" gap="1">
          <Flex align="center" gap="2">
            <Skeleton height="18px" width="88px" />
            <Skeleton height="14px" width="144px" />
          </Flex>
          <Skeleton height="12px" width="220px" />
        </Flex>
      ))}
    </Flex>
  );
}
