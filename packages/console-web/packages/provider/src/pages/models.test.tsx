import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { MemoryRouter } from "react-router-dom";
import { ModelCategory } from "@code-code/agent-contract/model/v1";
import { ModelsPage } from "./models";
import { useModelRegistryState } from "../domains/models/use-model-registry-state";

vi.mock("../domains/models/use-model-registry-state", () => ({
  useModelRegistryState: vi.fn()
}));

const useModelRegistryStateMock = vi.mocked(useModelRegistryState);

function mockRegistryState(overrides?: Partial<ReturnType<typeof useModelRegistryState>>) {
  useModelRegistryStateMock.mockReturnValue({
    availabilityFilter: "",
    handleAvailabilityChange: vi.fn(),
    handleCategoryChange: vi.fn(),
    handleClearAllFilters: vi.fn(),
    handleLifecycleToggle: vi.fn(),
    handleModelQueryClear: vi.fn(),
    handleModelQueryChange: vi.fn(),
    handleNextPage: vi.fn(),
    handleSourceClear: vi.fn(),
    handleSourceToggle: vi.fn(),
    handleVendorClear: vi.fn(),
    handleVendorSetOnly: vi.fn(),
    handleVendorToggle: vi.fn(),
    hideDeprecated: true,
    modelQuery: "",
    models: { models: [], nextPageToken: "", totalCount: 0, isLoading: false, error: undefined, mutate: vi.fn() },
    pageIndex: 0,
    selectedCategory: "",
    sourceIds: [],
    totalPages: 0,
    setPageIndex: vi.fn(),
    vendorIds: [],
    vendors: { vendors: [], isLoading: false, mutate: vi.fn() },
    vendorsById: {},
    ...overrides,
  } as ReturnType<typeof useModelRegistryState>);
}

describe("ModelsPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows a retry action for error states", () => {
    const mutate = vi.fn();
    mockRegistryState({
      models: { models: [], nextPageToken: "", totalCount: 0, isLoading: false, error: new Error("boom"), mutate },
    });

    render(<MemoryRouter><Theme><ModelsPage /></Theme></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("renders the models table without catalog binding warnings", () => {
    mockRegistryState();

    render(<MemoryRouter><Theme><ModelsPage /></Theme></MemoryRouter>);

    expect(screen.queryByText(/unbound/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Model catalog" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search models or services/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vendors" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Services" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Availability" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Vendor" })).not.toBeInTheDocument();
  });

  it("shows active search and category filters with clear actions", () => {
    const handleModelQueryClear = vi.fn();
    const handleCategoryChange = vi.fn();
    mockRegistryState({
      handleCategoryChange,
      handleModelQueryClear,
      modelQuery: "gpt 5",
      selectedCategory: String(ModelCategory.CHAT),
    });

    render(<MemoryRouter><Theme><ModelsPage /></Theme></MemoryRouter>);

    expect(screen.getByText("Search: gpt 5")).toBeInTheDocument();
    expect(screen.getByText("Category: Chat")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Search: gpt 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Category: Chat" }));
    expect(handleModelQueryClear).toHaveBeenCalledTimes(1);
    expect(handleCategoryChange).toHaveBeenCalledWith("");
  });

  it("shows total pages when the API provides totalCount", () => {
    mockRegistryState({
      totalPages: 36,
      models: { models: [], nextPageToken: "page2", totalCount: 720, isLoading: false, error: undefined, mutate: vi.fn() },
    });

    render(<MemoryRouter><Theme><ModelsPage /></Theme></MemoryRouter>);

    expect(screen.getByText("Page 1 / 36")).toBeInTheDocument();
  });
});
