import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const themeOptions = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor }
] as const;

function ThemeIcon({
  theme,
  resolvedTheme
}: {
  theme?: string;
  resolvedTheme?: string;
}) {
  if (theme === 'light') {
    return <Sun className="size-4" />;
  }

  if (theme === 'dark') {
    return <Moon className="size-4" />;
  }

  if (resolvedTheme === 'dark') {
    return <Monitor className="size-4" />;
  }

  return <Monitor className="size-4" />;
}

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const currentTheme = theme ?? 'system';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="切换主题"
          title="切换主题"
          className="text-muted-foreground"
        >
          <ThemeIcon theme={theme} resolvedTheme={resolvedTheme} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup
          value={currentTheme}
          onValueChange={(value) => setTheme(value)}
        >
          {themeOptions.map((option) => {
            const Icon = option.icon;

            return (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <Icon className="size-4 text-muted-foreground" />
                <span className="flex-1">{option.label}</span>
                {currentTheme === option.value ? (
                  <Check className="size-4 text-foreground" />
                ) : null}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
