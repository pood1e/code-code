import { useEffect, useMemo } from "react";
import { Button, Flex, Spinner, Text } from "@radix-ui/themes";
import { useSearchParams } from "react-router-dom";
import { readOAuthAuthorizeTarget } from "../oauth-authorize-route";
import { ErrorCallout, openExternalUrl } from "@code-code/console-web-ui";

export function OAuthAuthorizePageRoute() {
  const [searchParams] = useSearchParams();
  const redirectTarget = useMemo(
    () => normalizeAuthorizationURL(readOAuthAuthorizeTarget(searchParams)),
    [searchParams]
  );

  useEffect(() => {
    if (!redirectTarget) {
      return;
    }
    openExternalUrl(redirectTarget, { sameTab: true });
  }, [redirectTarget]);

  if (!redirectTarget) {
    return (
      <ErrorCallout>Authorization URL is missing or invalid.</ErrorCallout>
    );
  }

  return (
    <Flex direction="column" align="center" justify="center" gap="3" style={{ minHeight: 240 }}>
      <Spinner size="3" />
      <Text size="2" color="gray">Redirecting to provider authorization…</Text>
      <Button
        variant="soft"
        color="gray"
        onClick={() => {
          openExternalUrl(redirectTarget, { sameTab: true });
        }}
      >
        Continue
      </Button>
    </Flex>
  );
}

function normalizeAuthorizationURL(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}
