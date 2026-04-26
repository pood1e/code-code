import { defineToolCallRenderer } from "@copilotkit/react-core/v2";
import { formatToolCallPayload } from "./chat-tool-call-format";

function ChatToolCallCard({
  name,
  args,
  status,
  result,
}: {
  name: string;
  args: unknown;
  status: string;
  result?: string;
}) {
  return (
    <div className="chatToolCallPanel">
      <div className="chatToolCallPanelHeader">
        <span className="chatToolCallPanelBadge">{statusLabel(status)}</span>
        <span className="chatToolCallPanelName">{name}</span>
      </div>
      <div className="chatToolCallPanelBody">
        <div className="chatToolCallPanelSection">
          <div className="chatToolCallPanelLabel">Args</div>
          <pre className="chatToolCallPanelCode">{formatToolCallPayload(args)}</pre>
        </div>
        {result ? (
          <div className="chatToolCallPanelSection">
            <div className="chatToolCallPanelLabel">Result</div>
            <pre className="chatToolCallPanelCode">{formatToolCallPayload(result)}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "in_progress") {
    return "Pending";
  }
  if (status === "executing") {
    return "Running";
  }
  if (status === "complete") {
    return "Complete";
  }
  return status;
}

export const chatToolCallRenderers = [
  defineToolCallRenderer({
    name: "*",
    render: (props) => (
      <ChatToolCallCard
        name={props.name}
        args={props.args}
        status={String(props.status)}
        result={props.result}
      />
    ),
  }),
];
