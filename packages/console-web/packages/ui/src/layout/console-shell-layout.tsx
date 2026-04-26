import "./layout.css";
import { Flex, Theme } from "@radix-ui/themes";
import { ConsoleSidebar } from "./console-sidebar";
import { ConsoleMainContentShell } from "./console-main-content-shell";
import type { ConsoleShellLayoutProps } from "./types";

export function ConsoleShellLayout({
  brand,
  sidebarCollapsed,
  navItems,
  activeNavKey,
  theme,
  onToggleSidebar,
  onSelectNav,
  onToggleTheme,
  contentMode,
  children
}: ConsoleShellLayoutProps) {
  return (
    <Theme accentColor="teal" appearance={theme} grayColor="sage" radius="medium">
      <Flex minHeight="100vh" className="shellRoot">
        <ConsoleSidebar
          activeKey={activeNavKey}
          brand={brand}
          collapsed={sidebarCollapsed}
          items={navItems}
          theme={theme}
          onSelect={onSelectNav}
          onToggleTheme={onToggleTheme}
          onToggleSidebar={onToggleSidebar}
        />
        <ConsoleMainContentShell contentMode={contentMode}>
          {children}
        </ConsoleMainContentShell>
      </Flex>
    </Theme>
  );
}
