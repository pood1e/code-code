import {
  ActionBarPrimitive,
  MessagePrimitive,
  useAui,
  useAuiState
} from '@assistant-ui/react';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function UserMessageBubble() {
  return (
    <MessagePrimitive.Root className="group flex w-full flex-col py-6">
      <div className="flex w-full max-w-4xl mx-auto flex-col items-end gap-1 px-4 sm:px-0">
        <div className="flex items-center gap-2 mb-1 justify-end">
          <span className="text-xs font-medium text-muted-foreground/80 mr-1">You</span>
        </div>
        <div className="rounded-2xl rounded-tr-sm bg-muted/80 px-5 py-3 text-[14px] leading-relaxed text-foreground max-w-[90%] sm:max-w-[80%]">
          <MessagePrimitive.Parts
            components={{
              Text: ({ text }) => <div className="whitespace-pre-wrap font-sans">{text}</div>
            }}
          />
        </div>
        <div className="mt-2 flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
          <ActionBarPrimitive.Edit asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="size-7 text-muted-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10"
              title="编辑"
            >
              <Pencil className="size-3.5" />
            </Button>
          </ActionBarPrimitive.Edit>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

export function UserMessageEditComposer() {
  const aui = useAui();
  const value = useAuiState((state) => state.message.composer.text);

  return (
    <MessagePrimitive.Root className="flex w-full flex-col py-6">
      <div className="flex w-full max-w-4xl mx-auto flex-col items-end gap-2 px-4 sm:px-0">
        <div className="flex items-center gap-2 mb-1 justify-end">
          <span className="text-xs font-medium text-muted-foreground/80 mr-1">You</span>
        </div>
        <div className="w-full max-w-[90%] sm:max-w-[80%]">
          <Textarea
            className="min-h-24 resize-y rounded-2xl rounded-tr-sm border border-input bg-background p-4 text-[14px] focus-visible:ring-1 focus-visible:ring-ring shadow-sm"
            rows={4}
            value={value}
            onChange={(event) => {
              aui.message().composer().setText(event.target.value);
            }}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                aui.message().composer().cancel();
              }}
            >
              取消
            </Button>
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => {
                aui.message().composer().send();
              }}
            >
              保存并重跑
            </Button>
          </div>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}
