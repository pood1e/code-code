import { useMemo, useState, type ReactNode } from "react";
import { requestErrorMessage } from "@code-code/console-web-ui";
import { ResourceListSection } from "./resource-list-section";

type ResourceSummary = {
  id: string;
  name: string;
};

type ResourceDialogProps<T> = {
  item: T | null;
  open: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (item: T) => Promise<void> | void;
};

type ResourceCrudTabProps<TSummary extends ResourceSummary, TDraft> = {
  title: string;
  items: readonly TSummary[];
  emptyText: string;
  renderHeaderSuffix?: (item: TSummary) => ReactNode;
  renderBody: (item: TSummary) => ReactNode;
  createDraft: () => TDraft;
  onLoad: (id: string) => Promise<TDraft>;
  onSave: (item: TDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  getLoadErrorMessage: (itemName: string) => string;
  getSaveErrorMessage: () => string;
  renderDialog: (props: ResourceDialogProps<TDraft>) => ReactNode;
};

export function ResourceCrudTab<TSummary extends ResourceSummary, TDraft>({
  title,
  items,
  emptyText,
  renderHeaderSuffix,
  renderBody,
  createDraft,
  onLoad,
  onSave,
  onDelete,
  getLoadErrorMessage,
  getSaveErrorMessage,
  renderDialog,
}: ResourceCrudTabProps<TSummary, TDraft>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingItem, setEditingItem] = useState<TDraft | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const dialogItem = useMemo(() => {
    if (isCreating) {
      return createDraft();
    }
    return editingItem;
  }, [isCreating, editingItem, createDraft]);

  const closeDialog = () => {
    setIsCreating(false);
    setEditingId(null);
    setEditingItem(null);
    setIsSubmitting(false);
    setSubmitError(null);
  };

  return (
    <>
      <ResourceListSection
        title={title}
        items={items}
        emptyText={emptyText}
        onCreate={() => {
          setIsCreating(true);
          setEditingId(null);
          setEditingItem(null);
          setSubmitError(null);
        }}
        onEdit={(item) => {
          void (async () => {
            setIsSubmitting(true);
            setSubmitError(null);
            try {
              setEditingItem(await onLoad(item.id));
              setEditingId(item.id);
              setIsCreating(false);
            } catch (error) {
              setSubmitError(requestErrorMessage(error, getLoadErrorMessage(item.name)));
            } finally {
              setIsSubmitting(false);
            }
          })();
        }}
        onDelete={(item) => {
          void onDelete(item.id);
        }}
        renderHeaderSuffix={renderHeaderSuffix}
        renderBody={renderBody}
      />

      {renderDialog({
        item: dialogItem,
        open: isCreating || editingId !== null || isSubmitting,
        isSubmitting,
        submitError,
        onOpenChange: (nextOpen) => {
          if (!nextOpen) {
            closeDialog();
          }
        },
        onSubmit: async (item) => {
          setIsSubmitting(true);
          setSubmitError(null);
          try {
            await onSave(item);
            closeDialog();
          } catch (error: unknown) {
            setSubmitError(requestErrorMessage(error, getSaveErrorMessage()));
          } finally {
            setIsSubmitting(false);
          }
        },
      })}
    </>
  );
}
