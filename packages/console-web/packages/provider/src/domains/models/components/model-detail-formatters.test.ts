import { create } from "@bufbuild/protobuf";
import {
  AliasKind,
  ModelAliasSchema,
} from "@code-code/agent-contract/model/v1";
import { describe, expect, it } from "vitest";
import { formatAlias } from "./model-detail-formatters";

describe("model detail formatters", () => {
  it("formats aliases with semantic kind", () => {
    const alias = create(ModelAliasSchema, { kind: AliasKind.SNAPSHOT, value: "gpt-4o-2024-08-06" });

    expect(formatAlias(alias)).toBe("Snapshot: gpt-4o-2024-08-06");
  });
});
