import { Text } from "@radix-ui/themes";
import { emptyMCPDraft } from "../domain/resource-adapters";
import type { MCPResourceDraft, MCPResourceSummary } from "../domain/types";
import { MCPResourceDialog } from "./mcp-resource-dialog";
import { ResourceCrudTab } from "./resource-crud-tab";
import { SoftBadge } from "@code-code/console-web-ui";

type MCPResourceTabProps = {
  items: MCPResourceSummary[];
  onLoad: (id: string) => Promise<MCPResourceDraft>;
  onSave: (item: MCPResourceDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function MCPResourceTab({ items, onLoad, onSave, onDelete }: MCPResourceTabProps) {
  return (
    <ResourceCrudTab
      title="MCPs"
      items={items}
      emptyText="No MCP resources yet."
      onLoad={onLoad}
      onSave={onSave}
      onDelete={onDelete}
      createDraft={emptyMCPDraft}
      renderHeaderSuffix={(item) => <SoftBadge color="gray" label={item.transport} />}
      renderBody={(item) => <Text size="1" color="gray">{describeMcp(item)}</Text>}
      getLoadErrorMessage={() => "Failed to load MCP"}
      getSaveErrorMessage={() => "Failed to save MCP"}
      renderDialog={(props) => (
        <MCPResourceDialog
          item={props.item}
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

function describeMcp(item: MCPResourceSummary) {
  return item.summary;
}
