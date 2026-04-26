import { Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { useOverviewProviderAccounts } from "../domains/overview/api";
import { OverviewIssuesCard } from "../domains/overview/components/overview-issues-card";
import { OverviewSummaryCard } from "../domains/overview/components/overview-summary-card";
import { collectOverviewIssues, summarizeProviderAccounts } from "../domains/overview/view";

export function OverviewPage() {
  const {
    providerAccounts,
    isLoading: providerAccountsLoading,
    isError: providerAccountsError,
  } = useOverviewProviderAccounts();

	const providerSummary = summarizeProviderAccounts(providerAccounts);
	const issues = collectOverviewIssues(providerSummary);
	const issuesLoading = providerAccountsLoading;
	const issuesError = providerAccountsError;

  return (
    <Flex direction="column" gap="4">
      <Flex direction="column" gap="1">
        <Heading size="5" weight="medium">Operations Overview</Heading>
        <Text size="2" color="gray">
          Readiness summary for shared provider accounts.
        </Text>
      </Flex>
      <Grid columns={{ initial: "1", md: "2" }} gap="4">
        <OverviewSummaryCard
          title="Provider Accounts"
          summary={providerSummary}
          isLoading={providerAccountsLoading}
          isError={providerAccountsError}
        />
        <div style={{ gridColumn: "1 / -1" }}>
          <OverviewIssuesCard
            issues={issues}
            isLoading={issuesLoading}
            isError={issuesError}
          />
        </div>
      </Grid>
    </Flex>
  );
}
