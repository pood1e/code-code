import { Fragment, type ReactNode } from "react";
import { Flex } from "@radix-ui/themes";
import { ActionIconButton } from "./action-icon-button";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "./action-icons";
import { NoDataCallout } from "./no-data-callout";

type RuntimeFallbackListProps<T> = {
  items: T[];
  rowKey: (item: T, index: number) => string;
  emptyText: ReactNode;
  listClassName?: string;
  emptyClassName?: string;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  onRemove?: (index: number) => void;
  canMoveUp?: (index: number, total: number) => boolean;
  canMoveDown?: (index: number, total: number) => boolean;
  canRemove?: (index: number, total: number) => boolean;
  renderRow: (params: {
    item: T;
    index: number;
    actions?: ReactNode;
  }) => ReactNode;
};

export function RuntimeFallbackList<T>({
  items,
  rowKey,
  emptyText,
  listClassName,
  emptyClassName,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
  canRemove,
  renderRow,
}: RuntimeFallbackListProps<T>) {
  if (items.length === 0) {
    return (
      <NoDataCallout size="1" className={emptyClassName}>
        {emptyText}
      </NoDataCallout>
    );
  }

  return (
    <Flex direction="column" gap="2" className={listClassName}>
      {items.map((item, index) => {
        const actions = buildActions({
          index,
          total: items.length,
          onMoveUp,
          onMoveDown,
          onRemove,
          canMoveUp,
          canMoveDown,
          canRemove,
        });
        return (
          <Fragment key={rowKey(item, index)}>
            {renderRow({ item, index, actions })}
          </Fragment>
        );
      })}
    </Flex>
  );
}

function buildActions({
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
  canRemove,
}: {
  index: number;
  total: number;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  onRemove?: (index: number) => void;
  canMoveUp?: (index: number, total: number) => boolean;
  canMoveDown?: (index: number, total: number) => boolean;
  canRemove?: (index: number, total: number) => boolean;
}) {
  if (!onMoveUp && !onMoveDown && !onRemove) {
    return undefined;
  }

  return (
    <Flex gap="1" wrap="wrap">
      {onMoveUp ? (
        <ActionIconButton
          size="1"
          variant="soft"
          color="gray"
          aria-label="Move fallback up"
          title="Move fallback up"
          disabled={canMoveUp ? !canMoveUp(index, total) : index === 0}
          onClick={() => onMoveUp(index)}
        >
          <ChevronUpIcon />
        </ActionIconButton>
      ) : null}
      {onMoveDown ? (
        <ActionIconButton
          size="1"
          variant="soft"
          color="gray"
          aria-label="Move fallback down"
          title="Move fallback down"
          disabled={canMoveDown ? !canMoveDown(index, total) : index === total - 1}
          onClick={() => onMoveDown(index)}
        >
          <ChevronDownIcon />
        </ActionIconButton>
      ) : null}
      {onRemove ? (
        <ActionIconButton
          size="1"
          variant="soft"
          color="gray"
          aria-label="Remove fallback"
          title="Remove fallback"
          disabled={canRemove ? !canRemove(index, total) : false}
          onClick={() => onRemove(index)}
        >
          <CloseIcon />
        </ActionIconButton>
      ) : null}
    </Flex>
  );
}
