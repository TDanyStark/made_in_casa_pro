import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CategorySelect from "@/components/products/CategorySelect";

jest.mock("@/lib/services/apiService", () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

import { get } from "@/lib/services/apiService";
const mockGet = get as jest.MockedFunction<typeof get>;

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let latestSelectProps: any;
jest.mock("react-select/creatable", () => ({
  __esModule: true,
  default: (props: unknown) => {
    latestSelectProps = props;
    return <div data-testid="category-select" />;
  },
}));

function renderCategorySelect() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CategorySelect value={null} onChange={jest.fn()} />
    </QueryClientProvider>
  );
}

// CategorySelect is embedded in CreateProductModal / EditProductModal, both
// Dialogs (Radix). It must never portal or force fixed positioning — see
// ManagerSelect.tsx for the full root-cause writeup (react-remove-scroll
// shard + transform-containing-block coordinate mismatch).
describe("CategorySelect — safe in-dialog react-select props", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestSelectProps = undefined;
    mockGet.mockResolvedValue({ ok: true, status: 200, data: [] });
  });

  it("does not portal or force fixed positioning; keeps placement bottom and height bounded to 240", async () => {
    renderCategorySelect();

    await waitFor(() => expect(latestSelectProps).toBeDefined());

    expect(latestSelectProps.menuPortalTarget).toBeUndefined();
    expect(latestSelectProps.menuPosition).toBeUndefined();
    expect(latestSelectProps.styles).toBeUndefined();
    expect(latestSelectProps.menuPlacement).toBe("bottom");
    expect(latestSelectProps.maxMenuHeight).toBe(240);
  });
});
