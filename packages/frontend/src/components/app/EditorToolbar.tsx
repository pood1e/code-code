import { ArrowLeft, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';

type EditorToolbarProps = {
  title: string;
  onBack: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
};

export function EditorToolbar({
  title,
  onBack,
  onSave,
  saveDisabled = false
}: EditorToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-4">
      <p className="truncate text-sm font-medium text-foreground">{title}</p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="返回"
          title="返回"
          onClick={onBack}
        >
          <ArrowLeft data-icon="inline-start" />
          <span className="hidden sm:inline">返回</span>
        </Button>
        <Button
          type="button"
          size="sm"
          aria-label="保存"
          title="保存"
          onClick={onSave}
          disabled={saveDisabled}
        >
          <Save data-icon="inline-start" />
          <span className="hidden sm:inline">保存</span>
        </Button>
      </div>
    </div>
  );
}
