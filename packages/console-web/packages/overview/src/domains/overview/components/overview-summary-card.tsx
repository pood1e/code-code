import { Flex, Grid, Skeleton, Text } from "@radix-ui/themes";
import type { OverviewSummary } from "../view";
import { OverviewAsyncCard } from "./overview-async-card";

type Props = {
  title: string;
  summary: OverviewSummary;
  isLoading: boolean;
  isError: boolean;
};

export function OverviewSummaryCard({ title, summary, isLoading, isError }: Props) {
  return (
    <OverviewAsyncCard
      title={title}
      description="Readiness from management read models."
      isLoading={isLoading}
      isError={isError}
      errorMessage={`Failed to load ${title.toLowerCase()}.`}
      isEmpty={false}
      emptyMessage="No data."
      loadingContent={<OverviewSummarySkeleton />}
    >
      <Grid columns="2" gap="3">
        <SummaryMetric label="Total" value={summary.total} />
        <SummaryMetric label="Ready" value={summary.ready} tone="green" />
        <SummaryMetric label="Attention" value={summary.attention} tone="amber" />
        <SummaryMetric label="Unknown" value={summary.unknown} tone="gray" />
      </Grid>
    </OverviewAsyncCard>
  );
}

function SummaryMetric({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: number;
  tone?: "green" | "amber" | "gray";
}) {
  return (
    <Flex direction="column" gap="1">
      <Text size="1" color="gray">{label}</Text>
      <Text size="6" weight="bold" color={tone}>{value}</Text>
    </Flex>
  );
}

function OverviewSummarySkeleton() {
  return (
    <Grid columns="2" gap="3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Flex key={index} direction="column" gap="1">
          <Skeleton height="12px" width="64px" />
          <Skeleton height="28px" width="48px" />
        </Flex>
      ))}
    </Grid>
  );
}
