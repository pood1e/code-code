import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorCalloutIf } from "./error-callout-if";

describe("ErrorCalloutIf", () => {
  it("renders Error objects as messages", () => {
    const { getByRole } = render(<ErrorCalloutIf error={new Error("RBAC: access denied")} />);

    expect(getByRole("alert")).toHaveTextContent("RBAC: access denied");
  });

  it("does not render empty strings", () => {
    const { container } = render(<ErrorCalloutIf error=" " />);

    expect(container).toBeEmptyDOMElement();
  });
});
