import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { MemoryRouter } from "react-router-dom";
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
    handleModelQueryChange: vi.fn(),
    handleNextPage: vi.fn(),
    handleSourceClear: vi.fn(),
    handleSourceToggle: vi.fn(),
    handleVendorClear: vi.fn(),
    handleVendorSetOnly: vi.fn(),
    handleVendorToggle: vi.fn(),
    modelQuery: "",
    models: { models: [], nextPageToken: "", totalCount: 0, isLoading: false, error: undefined, mutate: vi.fn() },
    pageIndex: 0,
    proxyGroups: {},
    proxyModels: { models: [], nextPageToken: "", totalCount: 0, isLoading: false, error: undefined, mutate: vi.fn() },
    sourceIds: [],
    totalPages: 0,
    setPageIndex: vi.fn(),
    vendorIds: [],
    vendors: { vendors: [], mutate: vi.fn() },
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
    expect(screen.getByPlaceholderText(/search.+model id/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vendors" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sources" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Availability" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Vendor" })).not.toBeInTheDocument();
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
