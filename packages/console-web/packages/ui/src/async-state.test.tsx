import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AsyncState } from "./async-state";

describe("AsyncState", () => {
  it("renders loading skeletons", () => {
    const { container } = render(<AsyncState loading>{null}</AsyncState>);

    expect(container.querySelectorAll(".rt-Skeleton").length).toBeGreaterThan(0);
  });

  it("renders retry action on error", () => {
    const onRetry = vi.fn();
    const { getByRole } = render(
      <AsyncState error={new Error("boom")} onRetry={onRetry}>
        <div>content</div>
      </AsyncState>
    );

    fireEvent.click(getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders empty state copy", () => {
    const { getByText } = render(
      <AsyncState isEmpty emptyTitle="No credentials found." emptyDescription="Create one first.">
        <div>content</div>
      </AsyncState>
    );

    expect(getByText("No credentials found.")).toBeInTheDocument();
    expect(getByText("Create one first.")).toBeInTheDocument();
  });
});
