import { describe, expect, it } from "vitest";
import { providerObservabilityAuthPresentation } from "./provider-observability-auth-presentation";

describe("provider observability auth presentation", () => {
  it("returns Cerebras-specific authjs.session-token presentation", () => {
    const presentation = providerObservabilityAuthPresentation("cerebras");
    expect(presentation).not.toBeNull();
    if (!presentation) {
      throw new Error("presentation should not be null");
    }
    expect(presentation.fieldLabel).toBe("authjs.session-token");
    expect(presentation.separateProviderUpdate).toBe(true);
    expect(presentation.guideHref).toBe("https://github.com/nathabonfim59/cerebras-code-monitor");
  });

  it("returns Google AI Studio session presentation with minimal required fields", () => {
    const presentation = providerObservabilityAuthPresentation("google");
    expect(presentation).not.toBeNull();
    if (!presentation) {
      throw new Error("presentation should not be null");
    }
    expect(presentation.schemaId).toBe("google-ai-studio-session");
    expect(presentation.requiredKeys).toEqual(["cookie", "page_api_key", "project_id"]);
    expect(presentation.fields.map((field) => field.key)).toEqual([
      "cookie",
      "response_set_cookie",
      "authorization",
      "page_api_key",
      "project_id",
    ]);
    expect(presentation.fields[0]?.description).toContain("ListModelRateLimits");
  });

  it("does not expose generic observability auth presentation for other vendors", () => {
    const presentation = providerObservabilityAuthPresentation("minimax");
    expect(presentation).toBeNull();
  });
});
