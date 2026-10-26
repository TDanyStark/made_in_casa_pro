import { act } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WizardStep3Products } from "@/components/projects/wizard/WizardStep3Products";
import { WizardState } from "@/hooks/useProjectWizard";
import { ProductType } from "@/lib/definitions";

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${String(iconName)}`} />;
    MockIcon.displayName = String(iconName);
    return MockIcon;
  },
}));

jest.mock("@/lib/services/apiService", () => ({
  get: jest.fn().mockResolvedValue({ ok: true, data: { data: [] } }),
}));

// react-select/creatable's internals are irrelevant here — we only need to
// capture the `onCreateOption` callback the component wires up, the same way
// a user typing + clicking "Crear producto ..." would trigger it.
let capturedOnCreateOption: ((inputValue: string) => void) | undefined;
let capturedOnInputChange: ((inputValue: string) => void) | undefined;
let capturedOptions: { label?: string }[] | undefined;
jest.mock("react-select/creatable", () => ({
  __esModule: true,
  default: (props: {
    onCreateOption?: (inputValue: string) => void;
    onInputChange?: (inputValue: string) => void;
    options?: { label?: string }[];
  }) => {
    capturedOnCreateOption = props.onCreateOption;
    capturedOnInputChange = props.onInputChange;
    capturedOptions = props.options;
    return <div data-testid="product-select" />;
  },
}));

// Stub CreateProductModal: renders a button that fires onSuccess with a fake
// product when the modal is open, mirroring the real inline-creation flow.
let capturedModalProps:
  | { openModal?: boolean; initialName?: string; onSuccess?: (product: ProductType) => void }
  | undefined;
jest.mock("@/components/products/CreateProductModal", () => ({
  __esModule: true,
  default: (props: {
    openModal?: boolean;
    initialName?: string;
    onSuccess?: (product: ProductType) => void;
  }) => {
    capturedModalProps = props;
    if (!props.openModal) return null;
    return (
      <button
        type="button"
        onClick={() =>
          props.onSuccess?.({
            id: 999,
            name: props.initialName || "Producto sin nombre",
            description: null,
            category_id: null,
            category_name: "Categoría X",
            is_active: 1,
            created_at: "2026-01-01",
          })
        }
      >
        confirm-create-product
      </button>
    );
  },
}));

function renderWizardStep3(stateOverrides: Partial<WizardState> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const state = { product: null, ...stateOverrides } as WizardState;
  const onNext = jest.fn();
  const onBack = jest.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <WizardStep3Products state={state} onNext={onNext} onBack={onBack} />
    </QueryClientProvider>
  );

  return { onNext, onBack };
}

describe("WizardStep3Products — inline product creation autoselect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnCreateOption = undefined;
    capturedModalProps = undefined;
  });

  it("auto-selects a product created inline, without requiring it to appear in the fetched options list", async () => {
    renderWizardStep3();

    // Nothing selected yet — the empty-state placeholder is shown.
    expect(
      screen.getByText(/aún no has seleccionado un producto/i)
    ).toBeInTheDocument();

    // Simulate the user typing "Producto Nuevo" and choosing "Crear producto ...".
    act(() => {
      capturedOnCreateOption?.("Producto Nuevo");
    });

    await waitFor(() => expect(capturedModalProps?.openModal).toBe(true));
    expect(capturedModalProps?.initialName).toBe("Producto Nuevo");

    fireEvent.click(screen.getByText("confirm-create-product"));

    // The product created inline must be selected immediately — this does
    // NOT depend on it being present in `productOptions` (the react-query
    // search results), since selection is tracked via local `product` state.
    await waitFor(() => {
      expect(screen.getByText("Producto Nuevo")).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/aún no has seleccionado un producto/i)
    ).not.toBeInTheDocument();
  });

  it("clears the validation error once a product is selected", async () => {
    renderWizardStep3();

    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(
      await screen.findByText(/selecciona un producto para el proyecto/i)
    ).toBeInTheDocument();

    act(() => {
      capturedOnCreateOption?.("Producto Nuevo");
    });
    await waitFor(() => expect(capturedModalProps?.openModal).toBe(true));
    fireEvent.click(screen.getByText("confirm-create-product"));

    await waitFor(() => {
      expect(
        screen.queryByText(/selecciona un producto para el proyecto/i)
      ).not.toBeInTheDocument();
    });
  });

  it("calls onNext with the selected product when continuing", async () => {
    const { onNext } = renderWizardStep3();

    act(() => {
      capturedOnCreateOption?.("Producto Nuevo");
    });
    await waitFor(() => expect(capturedModalProps?.openModal).toBe(true));
    fireEvent.click(screen.getByText("confirm-create-product"));

    await waitFor(() =>
      expect(screen.getByText("Producto Nuevo")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    expect(onNext).toHaveBeenCalledWith({
      product: expect.objectContaining({ id: 999, name: "Producto Nuevo" }),
    });
  });
});

// S42: the product search uses the shared debounced search hook.
describe("WizardStep3Products product search", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { get: mockGet } = require("@/lib/services/apiService") as { get: jest.Mock };
  const searchedTerms = () =>
    mockGet.mock.calls.map(([url]) => new URLSearchParams(String(url).split("?")[1]).get("search"));

  beforeEach(() => {
    jest.useFakeTimers();
    mockGet.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it("searches the typed term after the debounce (previous behavior)", async () => {
    renderWizardStep3();
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    act(() => capturedOnInputChange?.("cam"));
    await act(async () => { jest.advanceTimersByTime(600); });
    await waitFor(() => expect(searchedTerms()).toContain("cam"));
  });

  it("clears the filter at once when the input is emptied, dropping the pending search", async () => {
    mockGet.mockImplementation(async (url: string) => {
      const term = new URLSearchParams(String(url).split("?")[1]).get("search") ?? "all";
      return { ok: true, data: { data: [{ id: term.length, name: `product-${term}`, is_active: 1 }] } };
    });
    const labels = () => (capturedOptions ?? []).map((o) => o.label);
    renderWizardStep3();
    await waitFor(() => expect(labels().join()).toContain("product-all"));
    act(() => capturedOnInputChange?.("cam"));
    await act(async () => { jest.advanceTimersByTime(600); });
    await waitFor(() => expect(labels().join()).toContain("product-cam"));

    act(() => capturedOnInputChange?.("camis"));
    act(() => capturedOnInputChange?.(""));

    // No debounce wait (and no waitFor, which advances fake timers): the cached unfiltered list is back at once.
    expect(labels().join()).toContain("product-all");
    await act(async () => { jest.advanceTimersByTime(600); });
    expect(searchedTerms()).not.toContain("camis");
    mockGet.mockReset();
    mockGet.mockResolvedValue({ ok: true, data: { data: [] } });
  });
});
