import type { ModelVersion } from "@code-code/agent-contract/model/v1";
import {
  formatCapability,
  formatModality,
  formatShape
} from "./model-detail-formatters";
import { formatContextBreakdown } from "./model-formatters";
import { ModelDetailBadges, ModelDetailRow, ModelDetailsSection, ModelDetailText } from "./model-details-section";

type ModelDetailsRuntimeProps = {
  model: ModelVersion;
};

export function ModelDetailsRuntime({ model }: ModelDetailsRuntimeProps) {
  const contextLines = formatContextBreakdown(model.contextSpec);

  return (
    <>
      {contextLines.length > 0 ? (
        <ModelDetailsSection title="Context Specification">
          {contextLines.map((line) => (
            <ModelDetailRow key={line.label} label={line.label}>
              <ModelDetailText>{line.value}</ModelDetailText>
            </ModelDetailRow>
          ))}
        </ModelDetailsSection>
      ) : null}

      <ModelDetailsSection title="Runtime">
        <ModelDetailRow label="Capabilities">
          <ModelDetailBadges values={model.capabilities.map(formatCapability)} />
        </ModelDetailRow>
        <ModelDetailRow label="Primary shape">
          <ModelDetailText>{formatShape(model.primaryShape)}</ModelDetailText>
        </ModelDetailRow>
        <ModelDetailRow label="Supported shapes">
          <ModelDetailBadges values={model.supportedShapes.map(formatShape)} />
        </ModelDetailRow>
        <ModelDetailRow label="Input modalities">
          <ModelDetailBadges values={model.inputModalities.map(formatModality)} />
        </ModelDetailRow>
        <ModelDetailRow label="Output modalities">
          <ModelDetailBadges values={model.outputModalities.map(formatModality)} />
        </ModelDetailRow>
      </ModelDetailsSection>
    </>
  );
}
