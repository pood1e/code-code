import { Text } from "@radix-ui/themes";
import { emptyTextResourceDraft } from "../domain/resource-adapters";
import type { TextResourceDraft, TextResourceSummary } from "../domain/types";
import { ResourceCrudTab } from "./resource-crud-tab";
import { TextResourceDialog } from "./text-resource-dialog";

type TextResourceTabProps = {
  kindLabel: "Skill" | "Rule";
  items: TextResourceSummary[];
  onLoad: (id: string) => Promise<TextResourceDraft>;
  onSave: (item: TextResourceDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function TextResourceTab({ kindLabel, items, onLoad, onSave, onDelete }: TextResourceTabProps) {
  return (
    <ResourceCrudTab
      title={`${kindLabel}s`}
      items={items}
      emptyText={`No ${kindLabel.toLowerCase()} resources yet.`}
      createDraft={() => emptyTextResourceDraft(kindLabel.toLowerCase() as "skill" | "rule")}
      onLoad={onLoad}
      onSave={onSave}
      onDelete={onDelete}
      getLoadErrorMessage={() => `Failed to load ${kindLabel}`}
      getSaveErrorMessage={() => `Failed to save ${kindLabel}`}
      renderBody={(item) => item.description ? <Text size="1" color="gray" style={descriptionStyle}>{item.description}</Text> : null}
      renderDialog={(props) => (
        <TextResourceDialog
          item={props.item}
          kindLabel={kindLabel}
          open={props.open}
          isSubmitting={props.isSubmitting}
          submitError={props.submitError}
          onOpenChange={props.onOpenChange}
          onSubmit={props.onSubmit}
        />
      )}
    />
  );
}

const descriptionStyle: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden"
};
