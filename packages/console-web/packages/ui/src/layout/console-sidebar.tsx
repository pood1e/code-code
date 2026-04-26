import "./layout.css";
import { Box, Flex, Text, Tooltip } from "@radix-ui/themes";
import { NavItem } from "./nav-item";
import { ThemeToggleButton } from "./theme-toggle-button";
import type { ConsoleSidebarProps } from "./types";

function CollapseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export function ConsoleSidebar({
  brand,
  collapsed,
  items,
  activeKey,
  theme,
  onSelect,
  onToggleTheme,
  onToggleSidebar
}: ConsoleSidebarProps) {
  return (
    <Flex
      direction="column"
      width={collapsed ? "72px" : "260px"}
      height="100vh"
      className="sidebar"
      aria-label="Console navigation"
      asChild
    >
      <aside>
        <Flex
          align="center"
          justify={collapsed ? "center" : "between"}
          px={collapsed ? "0" : "3"}
          py="4"
          minHeight="56px"
        >
          {!collapsed && (
            <Text size="3" color="teal" weight="bold" style={{ letterSpacing: "0.05em" }}>
              {brand.toUpperCase()}
            </Text>
          )}
          <button
            aria-label="Toggle sidebar"
            aria-expanded={!collapsed}
            data-testid="sidebar-toggle"
            onClick={onToggleSidebar}
            className={`sidebarCollapseButton ${collapsed ? "sidebarCollapseButtonCollapsed" : ""}`}
          >
            <CollapseIcon />
          </button>
        </Flex>

        <Flex direction="column" gap="1" px="3" pt="2" flexGrow="1">
          {items.map((item) => {
            const node = (
              <NavItem
                key={item.key}
                item={item}
                isActive={activeKey === item.key}
                collapsed={collapsed}
                onSelect={onSelect}
              />
            );
            return collapsed ? (
              <Tooltip key={item.key} content={item.label} side="right">
                {node}
              </Tooltip>
            ) : node;
          })}
        </Flex>

        <Box className="sidebarFooter">
          <ThemeToggleButton theme={theme} collapsed={collapsed} onToggleTheme={onToggleTheme} />
        </Box>
      </aside>
    </Flex>
  );
}
