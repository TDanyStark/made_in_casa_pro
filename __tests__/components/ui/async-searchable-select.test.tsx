import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AsyncSearchableSelect } from "@/components/ui/async-searchable-select";

const mockGet = jest.fn();

jest.mock("@/lib/services/apiService", () => ({
  get: (...args: unknown[]) => mockGet(...args),
}));

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

type BrandRow = { id: number; brand_name: string };

/** Filas reales de `GET /api/brands`: el nombre viene como `brand_name`. */
const BRAND_ROWS: BrandRow[] = [
  { id: 3, brand_name: "Marca A" },
  { id: 7, brand_name: "Marca B" },
];

function renderSelect(props: Partial<React.ComponentProps<typeof AsyncSearchableSelect<BrandRow>>> = {}) {
  const onValueChange = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <AsyncSearchableSelect<BrandRow>
        endpoint="brands"
        params={{ client_id: "4" }}
        getLabel={(row) => row.brand_name}
        value="all"
        onValueChange={onValueChange}
        allOption={{ value: "all", label: "Marca: todas" }}
        placeholder="Marca"
        searchPlaceholder="Buscar marca..."
        emptyMessage="Sin marcas."
        errorMessage="Error al cargar las marcas."
        {...props}
      />
    </QueryClientProvider>
  );
  return { onValueChange, ...utils };
}

const optionLabels = () => screen.getAllByRole("option").map((o) => o.textContent);

describe("AsyncSearchableSelect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ ok: true, data: { data: BRAND_ROWS } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not request anything until it is opened", () => {
    renderSelect();
    expect(mockGet).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox")).toHaveTextContent("Marca: todas");
  });

  it("loads the first page scoped to the client and labels rows with brand_name", async () => {
    renderSelect();
    fireEvent.click(screen.getByRole("combobox"));

    expect(await screen.findByText("Marca A")).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith("brands?client_id=4");
    expect(optionLabels()).toEqual(["Marca: todas", "Marca A", "Marca B"]);
  });

  it("requests the endpoint with the debounced search term and the client scope", async () => {
    jest.useFakeTimers();
    renderSelect();
    fireEvent.click(screen.getByRole("combobox"));
    await screen.findByText("Marca A");

    mockGet.mockResolvedValue({ ok: true, data: { data: [{ id: 9, brand_name: "Zeta" }] } });
    fireEvent.change(screen.getByPlaceholderText("Buscar marca..."), { target: { value: "ze" } });
    expect(mockGet).not.toHaveBeenCalledWith("brands?search=ze&client_id=4");

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(await screen.findByText("Zeta")).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith("brands?search=ze&client_id=4");
    expect(optionLabels()).toEqual(["Marca: todas", "Zeta"]);
  });

  it("omits empty params", async () => {
    renderSelect({ params: { client_id: undefined } });
    fireEvent.click(screen.getByRole("combobox"));

    await screen.findByText("Marca A");
    expect(mockGet).toHaveBeenCalledWith("brands");
  });

  it("calls onValueChange and keeps showing the captured label of the selected option", async () => {
    const { onValueChange, rerender } = renderSelect();
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("Marca B"));

    expect(onValueChange).toHaveBeenCalledWith("7");

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AsyncSearchableSelect<BrandRow>
          endpoint="brands"
          getLabel={(row) => row.brand_name}
          value="7"
          onValueChange={onValueChange}
          allOption={{ value: "all", label: "Marca: todas" }}
          placeholder="Marca"
        />
      </QueryClientProvider>
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Marca B");
  });

  it("resolves the label of an id that comes from the URL with fetchSelectedLabel", async () => {
    const fetchSelectedLabel = jest.fn().mockResolvedValue("Marca URL");
    renderSelect({ value: "12", fetchSelectedLabel });

    expect(await screen.findByText("Marca URL")).toBeInTheDocument();
    expect(fetchSelectedLabel).toHaveBeenCalledWith("12");
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("falls back to the selectedLabel given by the parent", () => {
    renderSelect({ value: "12", selectedLabel: "Marca seleccionada" });
    expect(screen.getByRole("combobox")).toHaveTextContent("Marca seleccionada");
  });

  it("shows the empty message when the search has no results", async () => {
    mockGet.mockResolvedValue({ ok: true, data: { data: [] } });
    renderSelect();
    fireEvent.click(screen.getByRole("combobox"));

    expect(await screen.findByText("Sin marcas.")).toBeInTheDocument();
    expect(optionLabels()).toEqual(["Marca: todas"]);
  });

  it("shows the error message when the request fails", async () => {
    mockGet.mockResolvedValue({ ok: false, error: "boom" });
    renderSelect();
    fireEvent.click(screen.getByRole("combobox"));

    expect(await screen.findByText("Error al cargar las marcas.")).toBeInTheDocument();
  });

  it("selects the all option", async () => {
    const { onValueChange } = renderSelect({ value: "3" });
    fireEvent.click(screen.getByRole("combobox"));
    await screen.findByRole("option", { name: "Marca A" });
    fireEvent.click(screen.getByRole("option", { name: "Marca: todas" }));

    expect(onValueChange).toHaveBeenCalledWith("all");
  });
});
