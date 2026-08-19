import { act } from "react";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AreaSelect from "@/components/users/AreaSelect";

jest.mock("@/lib/services/apiService", () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
}));

import { get, post, patch } from "@/lib/services/apiService";
const mockGet = get as jest.MockedFunction<typeof get>;
const mockPost = post as jest.MockedFunction<typeof post>;
const mockPatch = patch as jest.MockedFunction<typeof patch>;

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let latestSelectProps: any;
jest.mock("react-select/creatable", () => ({
  __esModule: true,
  default: (props: unknown) => {
    latestSelectProps = props;
    return <div data-testid="area-select" />;
  },
}));

function makeAreasResponse(areas: Array<{ id: number; name: string }>) {
  return {
    ok: true,
    status: 200,
    data: { data: areas, pageCount: 1, currentPage: 1, total: areas.length },
  };
}

function renderAreaSelect(props: Partial<React.ComponentProps<typeof AreaSelect>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AreaSelect user_id={1} {...props} />
    </QueryClientProvider>
  );
  return { queryClient };
}

describe("AreaSelect — persistent selection across refetches (useStableSelectOptions)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestSelectProps = undefined;
    mockPatch.mockResolvedValue({ ok: true, status: 200, data: {} });
  });

  it("keeps a selected area resolvable in `value` even after a refetch returns a list without it", async () => {
    mockGet.mockResolvedValue(
      makeAreasResponse([
        { id: 1, name: "Diseño" },
        { id: 2, name: "Programación/IT" },
      ])
    );

    const { queryClient } = renderAreaSelect();

    await waitFor(() => expect(latestSelectProps.options).toHaveLength(2));

    // User selects "Programación/IT".
    act(() => {
      latestSelectProps.onChange({ value: 2, label: "Programación/IT" });
    });

    await waitFor(() =>
      expect(latestSelectProps.value).toEqual({ value: 2, label: "Programación/IT" })
    );

    // Simulate a background refetch that returns a page WITHOUT "Programación/IT".
    mockGet.mockResolvedValue(makeAreasResponse([{ id: 3, name: "Escritura" }]));
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    await waitFor(() => {
      const hasEscritura = latestSelectProps.options.some(
        (option: { value: number }) => option.value === 3
      );
      expect(hasEscritura).toBe(true);
    });

    // The previously selected area must still resolve as the current value.
    expect(latestSelectProps.value).toEqual({ value: 2, label: "Programación/IT" });
  });

  it("auto-selects and pins an area created inline, surviving a subsequent refetch", async () => {
    mockGet.mockResolvedValue(makeAreasResponse([{ id: 1, name: "Diseño" }]));
    mockPost.mockResolvedValue({
      ok: true,
      status: 200,
      data: { id: 42, name: "Área Nueva" },
    });

    renderAreaSelect();
    await waitFor(() => expect(latestSelectProps.options).toHaveLength(1));

    await act(async () => {
      await latestSelectProps.onCreateOption("Área Nueva");
    });

    await waitFor(() =>
      expect(latestSelectProps.value).toEqual(
        expect.objectContaining({ value: 42, label: "Área Nueva" })
      )
    );

    // A subsequent refetch that doesn't include it must not lose the selection.
    mockGet.mockResolvedValue(makeAreasResponse([{ id: 1, name: "Diseño" }]));
    await waitFor(() =>
      expect(latestSelectProps.value).toEqual(
        expect.objectContaining({ value: 42, label: "Área Nueva" })
      )
    );

    expect(mockPatch).toHaveBeenCalledWith("users/1", { area_id: 42 });
  });
});
