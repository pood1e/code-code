import React, { useEffect, useRef } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';

import { Button } from '@/components/ui/button';

import { SessionMessageBubble } from './SessionAssistantThreadHistoryMessage';
import type { SessionAssistantMessageRecord } from './thread-adapter';

const MIN_RECORDS_TO_ANCHOR_LATEST = 5;

const VirtuosoScroller = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>((props, ref) => {
  return (
    <div
      {...props}
      ref={ref}
      role="log"
      aria-label="会话消息列表"
      className="scrollbar-hide min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      style={{
        ...props.style,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
    />
  );
});
VirtuosoScroller.displayName = 'VirtuosoScroller';

export function SessionAssistantThreadHistory({
  canReload,
  records,
  firstItemIndex,
  onLoadMore,
  onReload
}: {
  canReload: boolean;
  records: SessionAssistantMessageRecord[];
  firstItemIndex: number;
  onLoadMore?: () => void;
  onReload: () => Promise<void>;
}) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const lastMessageId = records.at(-1)?.message.id;
  const previousLastMessageIdRef = useRef<string | undefined>(undefined);
  const shouldAnchorToLatest = records.length >= MIN_RECORDS_TO_ANCHOR_LATEST;
  const firstAbsoluteIndex = firstItemIndex;
  const lastAbsoluteIndex = firstItemIndex + records.length - 1;

  useEffect(() => {
    if (!virtuosoRef.current || !lastMessageId || records.length === 0) {
      return;
    }

    if (previousLastMessageIdRef.current === undefined) {
      previousLastMessageIdRef.current = lastMessageId;
      if (shouldAnchorToLatest) {
        virtuosoRef.current.scrollToIndex({
          index: lastAbsoluteIndex,
          align: 'end',
          behavior: 'auto'
        });
      }
      return;
    }

    if (previousLastMessageIdRef.current === lastMessageId) {
      return;
    }

    previousLastMessageIdRef.current = lastMessageId;
    virtuosoRef.current.scrollToIndex({
      index: lastAbsoluteIndex,
      align: 'end',
      behavior: 'auto'
    });
  }, [firstItemIndex, lastAbsoluteIndex, lastMessageId, records.length, shouldAnchorToLatest]);

  return (
    <Virtuoso
      ref={virtuosoRef}
      alignToBottom={!shouldAnchorToLatest}
      className="min-h-0 flex-1"
      followOutput="auto"
      firstItemIndex={firstItemIndex}
      totalCount={records.length}
      initialTopMostItemIndex={
        shouldAnchorToLatest ? lastAbsoluteIndex : firstAbsoluteIndex
      }
      startReached={onLoadMore}
      computeItemKey={(index) =>
        records[index - firstItemIndex]?.message.id ?? `pending-${index}`
      }
      components={{
        Scroller: VirtuosoScroller,
        Header: onLoadMore
          ? () => (
              <div className="px-4 pt-2 sm:px-5">
                <div className="flex justify-center pb-1">
                  <Button variant="ghost" size="sm" onClick={onLoadMore}>
                    加载更早消息
                  </Button>
                </div>
              </div>
            )
          : undefined,
        Footer: () => <div className="h-2" />
      }}
      itemContent={(index) => {
        const relativeIndex = index - firstItemIndex;
        const record = records[relativeIndex];

        if (!record) {
          return <div className="px-4 pb-1 sm:px-5" />;
        }

        return (
          <div className="px-4 pb-1 sm:px-5">
            <SessionMessageBubble
              canReload={canReload}
              record={record}
              isLast={relativeIndex === records.length - 1}
              onReload={onReload}
            />
          </div>
        );
      }}
    />
  );
}
