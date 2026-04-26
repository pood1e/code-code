import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Box } from "@radix-ui/themes";
import { Outlet, useLocation } from "react-router-dom";
import { RootErrorFallback } from "./root-error-fallback";
import { AsyncState } from "@code-code/console-web-ui";
import { recordConsoleWebError } from "../telemetry/runtime";

function ShellOutletFallback() {
  return <AsyncState loading loadingCard>{null}</AsyncState>;
}

export function ShellRouteOutlet() {
  const location = useLocation();
  const fullBleed = location.pathname === "/grafana";

  return (
    <ErrorBoundary
      FallbackComponent={RootErrorFallback}
      onError={(error) => {
        recordConsoleWebError("react.error_boundary", error);
      }}
    >
      <Box height={fullBleed ? "100%" : undefined} mt={fullBleed ? undefined : "4"}>
        <Suspense fallback={<ShellOutletFallback />}>
          <Outlet />
        </Suspense>
      </Box>
    </ErrorBoundary>
  );
}
