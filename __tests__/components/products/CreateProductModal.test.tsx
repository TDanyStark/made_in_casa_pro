import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateProductModal from "@/components/products/CreateProductModal";

const mockPost = jest.fn();
const mockInvalidate = jest.fn();
const mockRefresh = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${String(iconName)}`} />;
    MockIcon.displayName = String(iconName);
    return MockIcon;
  },
}));

jest.mock("@/lib/services/apiService", () => ({
  post: (...args: unknown[]) => mockPost(...args),
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: (...a: unknown[]) => mockInvalidate(...a) }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => mockRefresh() }),
}));

jest.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => mockToastSuccess(...a),
    error: (...a: unknown[]) => mockToastError(...a),
  },
}));

// CategorySelect is heavy (CreatableSelect) — stub it out.
jest.mock("@/components/products/CategorySelect", () => ({
  __esModule: true,
  default: () => <div data-testid="category-select" />,
}));

describe("CreateProductModal — inline creation callback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefills the name from initialName", () => {
    render(
      <CreateProductModal
        openModal
        handleModal={() => {}}
        initialName="Nuevo Video"
        onSuccess={() => {}}
      />
    );
    expect(screen.getByDisplayValue("Nuevo Video")).toBeInTheDocument();
  });

  it("calls onSuccess with the created product and does NOT refresh", async () => {
    const createdProduct = {
      id: 77,
      name: "Nuevo Video",
      description: null,
      category_id: null,
      category_name: null,
      is_active: 1,
      created_at: "2026-01-01",
    };
    mockPost.mockResolvedValue({ ok: true, data: createdProduct });
    const onSuccess = jest.fn();

    render(
      <CreateProductModal
        openModal
        handleModal={() => {}}
        initialName="Nuevo Video"
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /crear/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(createdProduct);
    });
    // Inline flow must NOT trigger a full router refresh.
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith(
      "products",
      expect.objectContaining({ name: "Nuevo Video", is_active: 1 })
    );
  });

  it("falls back to router.refresh when no onSuccess is provided", async () => {
    mockPost.mockResolvedValue({ ok: true, data: { id: 1, name: "X" } });

    render(<CreateProductModal openModal handleModal={() => {}} initialName="X" />);

    fireEvent.click(screen.getByRole("button", { name: /crear/i }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
