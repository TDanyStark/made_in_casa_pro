// Spec: odd/tasks/project-additional-brands.md — S6, S7, S8
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdditionalBrandsSelect } from "@/components/brands/AdditionalBrandsSelect";
import { ProjectBrandsCard } from "@/components/projects/ProjectBrandsCard";
import { ProjectPreviewCard } from "@/components/projects/ProjectPreviewCard";
import { WizardStep1Basics } from "@/components/projects/wizard/WizardStep1Basics";
import { ProjectDetailType } from "@/lib/definitions";
import { WizardState } from "@/hooks/useProjectWizard";

const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock("@/lib/services/apiService", () => ({
  get: (...a: unknown[]) => mockGet(...a),
  patch: (...a: unknown[]) => mockPatch(...a),
  post: jest.fn(),
  del: jest.fn(),
}));
jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }));
jest.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => mockToastSuccess(...a),
    error: (...a: unknown[]) => mockToastError(...a),
  },
}));
jest.mock("@/components/brands/BrandSelect", () => ({ BrandSelect: () => null }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockSelectProps: any;
jest.mock("react-select", () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockSelectProps = props;
    return null;
  },
}));

function withClient(ui: React.ReactElement, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectProps = undefined;
});

describe("AdditionalBrandsSelect", () => {
  it("lists only brands of the client, excluding the principal, as a multi select", async () => {
    mockGet.mockResolvedValue({
      ok: true,
      data: {
        data: [
          { id: 2, brand_name: "A" },
          { id: 5, brand_name: "B" },
          { id: 6, brand_name: "C" },
        ],
      },
    });
    const onChange = jest.fn();

    withClient(
      <AdditionalBrandsSelect clientId={3} excludeBrandId={2} value={[{ id: 5, name: "B" }]} onChange={onChange} />
    );

    await waitFor(() => expect(mockSelectProps?.options).toHaveLength(2));
    expect(mockGet.mock.calls[0][0]).toContain("brands?client_id=3");
    expect(mockSelectProps.isMulti).toBe(true);
    expect(mockSelectProps.options).toEqual([
      { value: 5, label: "B" },
      { value: 6, label: "C" },
    ]);
    expect(mockSelectProps.value).toEqual([{ value: 5, label: "B" }]);

    mockSelectProps.onChange([{ value: 6, label: "C" }]);
    expect(onChange).toHaveBeenLastCalledWith([{ id: 6, name: "C" }]);
    mockSelectProps.onChange(null);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});

const project = {
  id: 6,
  brand_id: 2,
  brand_name: "A",
  client_id: 3,
  client_name: "Cliente",
  additional_brands: [{ id: 5, name: "B" }],
} as unknown as ProjectDetailType;

describe("ProjectBrandsCard", () => {
  beforeEach(() => mockGet.mockResolvedValue({ ok: true, data: { data: [] } }));

  it("saves the full set of additional brands and refreshes the project", async () => {
    mockPatch.mockResolvedValue({ ok: true, data: {} });
    const user = userEvent.setup();
    const { client } = withClient(<ProjectBrandsCard project={project} canEdit />);
    const invalidate = jest.spyOn(client, "invalidateQueries");

    await waitFor(() => expect(mockSelectProps).toBeDefined());
    expect(mockSelectProps.value).toEqual([{ value: 5, label: "B" }]);
    React.act(() => mockSelectProps.onChange([{ value: 5, label: "B" }, { value: 6, label: "C" }]));
    await user.click(screen.getByRole("button", { name: "Guardar marcas" }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith("projects/6", { additional_brand_ids: [5, 6] }));
    expect(mockToastSuccess).toHaveBeenCalledWith("Marcas asociadas actualizadas");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project", 6] });
  });

  it("shows the backend error and does not report success", async () => {
    mockPatch.mockResolvedValue({
      ok: false,
      error: "Todas las marcas del proyecto deben pertenecer al mismo cliente",
      data: { code: "BRAND_CLIENT_MISMATCH" },
    });
    const user = userEvent.setup();
    withClient(<ProjectBrandsCard project={project} canEdit />);

    await waitFor(() => expect(mockSelectProps).toBeDefined());
    React.act(() => mockSelectProps.onChange([{ value: 9, label: "X" }]));
    await user.click(screen.getByRole("button", { name: "Guardar marcas" }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Todas las marcas del proyecto deben pertenecer al mismo cliente")
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("read-only shows the principal and associated brands without a select", () => {
    withClient(<ProjectBrandsCard project={project} canEdit={false} />);

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(mockSelectProps).toBeUndefined();
  });

  it("read-only without associated brands says so", () => {
    withClient(<ProjectBrandsCard project={{ ...project, additional_brands: [] }} canEdit={false} />);

    expect(screen.getByText("Sin marcas asociadas")).toBeInTheDocument();
  });
});

const wizardState = {
  title: "Proyecto",
  brand_id: 2,
  brand_name: "A",
  additional_brands: [{ id: 5, name: "B" }, { id: 6, name: "C" }],
  client_name: "Cliente",
  manager_name: "",
  co_manager_names: [],
  product: null,
  campaign_name: "",
  notes: "",
  drive_folder_url: null,
  ideal_delivery_at: "",
  oc: "",
  billing_closed_at: "",
} as unknown as WizardState;

describe("wizard", () => {
  it("ProjectPreviewCard lists the associated brands", () => {
    render(<ProjectPreviewCard state={wizardState} />);

    expect(screen.getByText("Marcas asociadas: B, C")).toBeInTheDocument();
  });

  it("WizardStep1Basics sends the associated brands chosen for the principal brand's client", async () => {
    mockGet.mockImplementation(async (url: string) =>
      url === "brands/2"
        ? { ok: true, data: { id: 2, name: "A", manager_id: 7, client_id: 3, client_info: { id: 3, name: "Cliente" }, manager: { id: 7, name: "Ana", email: "a@x.co", client_id: 3 } } }
        : { ok: true, data: { data: [] } }
    );
    const onNext = jest.fn();
    const user = userEvent.setup();
    withClient(<WizardStep1Basics state={{ ...wizardState, additional_brands: [] }} onNext={onNext} />);

    await waitFor(() => expect(mockSelectProps).toBeDefined());
    expect(mockGet.mock.calls.some(([u]) => String(u).includes("brands?client_id=3"))).toBe(true);
    React.act(() => mockSelectProps.onChange([{ value: 5, label: "B" }]));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => expect(onNext).toHaveBeenCalled());
    expect(onNext.mock.calls[0][0]).toMatchObject({ brand_id: 2, client_id: 3, additional_brands: [{ id: 5, name: "B" }] });
  });
});
