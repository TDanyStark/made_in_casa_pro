import { act } from "react";
import { render, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClientSelect } from "@/components/clients/ClientSelect";
import { Form } from "@/components/ui/form";

jest.mock("@/lib/services/apiService", () => ({
  get: jest.fn(),
}));

import { get } from "@/lib/services/apiService";
const mockGet = get as jest.MockedFunction<typeof get>;

// Capture the props react-select/creatable receives on every render so tests
// can drive `onChange`/`onCreateOption` and assert on `value`/`options`
// without dealing with react-select's own DOM/portal internals.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let latestSelectProps: any;
jest.mock("react-select/creatable", () => ({
  __esModule: true,
  default: (props: unknown) => {
    latestSelectProps = props;
    return <div data-testid="client-select" />;
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let latestModalProps: any;
jest.mock("@/components/clients/CreateClientModal", () => ({
  __esModule: true,
  default: (props: unknown) => {
    latestModalProps = props;
    return null;
  },
}));

function makeClientsResponse(clients: Array<{ id: number; name: string }>) {
  return {
    ok: true,
    status: 200,
    data: { data: clients, pageCount: 1, currentPage: 1, total: clients.length },
  };
}

interface FormValues {
  client_id: number | undefined;
}

function renderClientSelect() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Harness() {
    const form = useForm<FormValues>({ defaultValues: { client_id: undefined } });
    return (
      <Form {...form}>
        <ClientSelect control={form.control} name="client_id" />
      </Form>
    );
  }

  render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>
  );

  return { queryClient };
}

describe("ClientSelect — persistent selection across refetches", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestSelectProps = undefined;
    latestModalProps = undefined;
  });

  it("keeps a selected client resolvable in `value` even after a refetch returns a list without it", async () => {
    mockGet.mockResolvedValue(
      makeClientsResponse([
        { id: 1, name: "Cliente Uno" },
        { id: 2, name: "Cliente Dos" },
      ])
    );

    const { queryClient } = renderClientSelect();

    await waitFor(() => expect(latestSelectProps.options).toHaveLength(2));

    // User selects "Cliente Dos".
    act(() => {
      latestSelectProps.onChange({ value: 2, label: "Cliente Dos" });
    });

    await waitFor(() => expect(latestSelectProps.value).toEqual({ value: 2, label: "Cliente Dos" }));

    // Simulate a background refetch (e.g. triggered elsewhere in the app)
    // that returns a page WITHOUT "Cliente Dos" — reproduces the reported bug.
    mockGet.mockResolvedValue(makeClientsResponse([{ id: 3, name: "Cliente Tres" }]));
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    await waitFor(() => {
      const hasClienteTres = latestSelectProps.options.some(
        (option: { value: number }) => option.value === 3
      );
      expect(hasClienteTres).toBe(true);
    });

    // The previously selected client must still resolve as the current value.
    expect(latestSelectProps.value).toEqual({ value: 2, label: "Cliente Dos" });
  });

  it("auto-selects and pins a client created inline via the modal", async () => {
    mockGet.mockResolvedValue(makeClientsResponse([{ id: 1, name: "Cliente Uno" }]));

    renderClientSelect();
    await waitFor(() => expect(latestSelectProps.options).toHaveLength(1));

    act(() => {
      latestSelectProps.onCreateOption("Cliente Nuevo");
    });

    expect(latestModalProps.initialName).toBe("Cliente Nuevo");

    // Simulate CreateClientModal's onSuccess callback with the created client.
    act(() => {
      latestModalProps.onSuccess({ id: 42, name: "Cliente Nuevo" });
    });

    await waitFor(() =>
      expect(latestSelectProps.value).toEqual(
        expect.objectContaining({ value: 42, label: "Cliente Nuevo" })
      )
    );

    // A subsequent refetch that doesn't include it must not lose the selection.
    mockGet.mockResolvedValue(makeClientsResponse([{ id: 1, name: "Cliente Uno" }]));
    await waitFor(() =>
      expect(latestSelectProps.value).toEqual(
        expect.objectContaining({ value: 42, label: "Cliente Nuevo" })
      )
    );
  });
});
