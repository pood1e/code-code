import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { VendorHeaderFilter } from "./vendor-header-filter";

const vendors = [
  { vendorId: "openai", displayName: "OpenAI", iconUrl: "https://example.com/openai.png" },
  { vendorId: "anthropic", displayName: "Anthropic", iconUrl: "https://example.com/anthropic.png" },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("VendorHeaderFilter", () => {
  it("filters vendors by search query and supports only selection", () => {
    const onSetOnly = vi.fn();

    render(
      <Theme>
        <VendorHeaderFilter
          onClear={vi.fn()}
          onSetOnly={onSetOnly}
          onToggle={vi.fn()}
          selectedValues={["openai"]}
          vendors={vendors}
        />
      </Theme>
    );

    fireEvent.click(screen.getByRole("button", { name: /filter vendor/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /search/i }), {
      target: { value: "anth" },
    });

    expect(screen.getByText("Anthropic")).toBeInTheDocument();
    expect(screen.queryByText("OpenAI")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Only" }));
    expect(onSetOnly).toHaveBeenCalledWith("anthropic");
  });

  it("exposes all action", () => {
    const onClear = vi.fn();

    render(
      <Theme>
        <VendorHeaderFilter
          onClear={onClear}
          onSetOnly={vi.fn()}
          onToggle={vi.fn()}
          selectedValues={["openai"]}
          vendors={vendors}
        />
      </Theme>
    );

    fireEvent.click(screen.getByRole("button", { name: /filter vendor/i }));
    fireEvent.click(screen.getByRole("button", { name: "All" }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
