import React, { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';

import { SessionMessageBubble } from './SessionAssistantThreadHistoryMessage';
import type { SessionAssistantMessageRecord } from './thread-adapter';

const MIN_RECORDS_TO_ANCHOR_LATEST = 5;

export function SessionAssistantThreadHistory({
  canReload,
  records,
  firstItemIndex: _firstItemIndex,
  onLoadMore,
  onReload
}: {
  canReload: boolean;
  records: SessionAssistantMessageRecord[];
  firstItemIndex: number;
  onLoadMore?: () => void;
  onReload: () => Promise<void>;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastMessageId = records.at(-1)?.message.id;
  const previousLastMessageIdRef = useRef<string | undefined>(undefined);
  const shouldAnchorToLatest = records.length >= MIN_RECORDS_TO_ANCHOR_LATEST;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !lastMessageId || records.length === 0) {
      return;
    }

    if (previousLastMessageIdRef.current === undefined) {
      previousLastMessageIdRef.current = lastMessageId;
      if (shouldAnchorToLatest) {
        scroller.scrollTop = scroller.scrollHeight;
      }
      return;
    }

    if (previousLastMessageIdRef.current === lastMessageId) {
      return;
    }

    previousLastMessageIdRef.current = lastMessageId;
    scroller.scrollTop = scroller.scrollHeight;
  }, [lastMessageId, records.length, shouldAnchorToLatest]);

  return (
    <div
      ref={scrollerRef}
      role="log"
      aria-label="会话消息列表"
      className="scrollbar-hide min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
    >
      {onLoadMore ? (
        <div className="px-4 pt-2 sm:px-5">
          <div className="flex justify-center pb-1">
            <Button variant="ghost" size="sm" onClick={onLoadMore}>
              加载更早消息
            </Button>
          </div>
        </div>
      ) : null}

      {records.map((record, index) => (
        <div key={record.message.id} className="px-4 pb-1 sm:px-5">
          <SessionMessageBubble
            canReload={canReload}
            record={record}
            isLast={index === records.length - 1}
            onReload={onReload}
          />
        </div>
      ))}

      <div className="h-2" />
    </div>
  );
}
