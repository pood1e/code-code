import { type ReactNode } from "react";

export type NavIconKey = "grid" | "layers" | "key" | "shield" | "link";

export type NavItem = {
  key: string;
  label: string;
  icon: NavIconKey;
};

export type Section = {
  key: string;
  label: string;
  icon: NavIconKey;
  headline: string;
};

export type ThemeMode = "light" | "dark";

export type ConsoleSidebarProps = {
  brand: string;
  collapsed: boolean;
  items: NavItem[];
  activeKey: string;
  theme: ThemeMode;
  onSelect: (key: string) => void;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
};

export type ConsoleMainContentShellProps = {
  contentMode?: "default" | "fullBleed";
  children: ReactNode;
};

export type ConsoleShellLayoutProps = {
  brand: string;
  sidebarCollapsed: boolean;
  navItems: NavItem[];
  activeNavKey: string;
  theme: ThemeMode;
  onToggleSidebar: () => void;
  onSelectNav: (key: string) => void;
  onToggleTheme: () => void;
  contentMode?: "default" | "fullBleed";
  children: ReactNode;
};
