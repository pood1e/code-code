import "./layout.css";
import { Box, ScrollArea } from "@radix-ui/themes";
import type { ConsoleMainContentShellProps } from "./types";

export function ConsoleMainContentShell({
  contentMode = "default",
  children
}: ConsoleMainContentShellProps) {
  const className = contentMode === "fullBleed"
    ? "mainContent mainContentFullBleed"
    : "mainContent";

  return (
    <ScrollArea className="scrollArea">
      <Box className={className}>
        {children}
      </Box>
    </ScrollArea>
  );
}
