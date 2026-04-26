import { Box, Text } from "@radix-ui/themes";
import { NavIcon } from "./nav-icon";
import type { NavItem as NavItemData } from "./types";

type NavItemProps = {
  item: NavItemData;
  isActive: boolean;
  collapsed: boolean;
  onSelect: (key: string) => void;
};

export function NavItem({ item, isActive, collapsed, onSelect }: NavItemProps) {
  return (
    <button
      aria-current={isActive ? "page" : undefined}
      aria-label={item.label}
      data-testid={`nav-item-${item.key}`}
      onClick={() => onSelect(item.key)}
      className={`navButton ${collapsed ? "navButtonCollapsed" : "navButtonExpanded"} ${isActive ? "navButtonActive" : ""}`}
    >
      <Box className="iconWrapper">
        <NavIcon icon={item.icon} />
      </Box>
      {!collapsed && (
        <Text size="2" weight={isActive ? "medium" : "regular"}>
          {item.label}
        </Text>
      )}
    </button>
  );
}
