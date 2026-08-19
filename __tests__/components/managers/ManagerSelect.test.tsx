import { render, screen, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ManagerSelect } from "@/components/managers/ManagerSelect";
import { Form } from "@/components/ui/form";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// dialog.tsx (real component, used below) imports XIcon from lucide-react.
jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${String(iconName)}`} />;
    MockIcon.displayName = String(iconName);
    return MockIcon;
  },
}));

jest.mock("@/lib/services/apiService", () => ({
  get: jest.fn(),
}));

import { get } from "@/lib/services/apiService";
const mockGet = get as jest.MockedFunction<typeof get>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let latestSelectProps: any;
jest.mock("react-select/creatable", () => ({
  __esModule: true,
  default: (props: unknown) => {
    latestSelectProps = props;
    return <div data-testid="manager-select" />;
  },
}));

jest.mock("@/components/managers/CreateManagerModal", () => ({
  __esModule: true,
  default: () => null,
}));

interface FormValues {
  manager_id: number | undefined;
}

function renderManagerSelect() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Harness() {
    const form = useForm<FormValues>({ defaultValues: { manager_id: undefined } });
    return (
      <Form {...form}>
        <ManagerSelect form={form} control={form.control} name="manager_id" clientId={5} />
      </Form>
    );
  }

  render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>
  );
}

// This is the exact select reported unusable on /projects/create → "Crear
// Marca": the manager dropdown was visible but could not be scrolled or
// clicked. Two portal-based attempts were tried and reverted:
//   1. menuPortalTarget={document.body} + menuPosition="fixed": the menu
//      inherited `pointer-events: none` from Radix's modal body-lock, AND
//      (even after fixing that) wheel/touchmove was still blocked because
//      Radix wraps its Dialog Overlay in react-remove-scroll with
//      `shards: [DialogContent]` — anything outside that shard is
//      preventDefault()'d.
//   2. menuPortalTarget={nearest DialogContent DOM node}: put the menu
//      inside the shard (fixing scroll), but DialogContent centers itself
//      via `translate-x/y`, which makes it the CSS containing block for its
//      `position: fixed` descendants — breaking react-select's naive
//      viewport-relative position math (the menu rendered in the wrong
//      place, sometimes appearing to render with zero visible height).
// The definitive fix: don't portal or force `position: fixed` at all. Let
// react-select render the menu in its own normal (in-flow) `position:
// absolute` mode, which is what these tests assert.
describe("ManagerSelect — menu renders in-flow, no portal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestSelectProps = undefined;
    mockGet.mockResolvedValue({
      ok: true,
      status: 200,
      data: { data: [], pageCount: 1, currentPage: 1, total: 0 },
    });
  });

  it("does not set menuPortalTarget or force menuPosition, but keeps placement/height bounded", async () => {
    renderManagerSelect();

    await waitFor(() => expect(latestSelectProps).toBeDefined());

    expect(latestSelectProps.menuPortalTarget).toBeUndefined();
    expect(latestSelectProps.menuPosition).toBeUndefined();
    expect(latestSelectProps.styles?.menuPortal).toBeUndefined();
    expect(latestSelectProps.menuPlacement).toBe("bottom");
    expect(latestSelectProps.maxMenuHeight).toBe(240);
  });
});

// Renders the REAL (unmocked) Dialog/DialogContent to prove the menu is a
// genuine DOM descendant of the dialog by construction (no portal needed),
// which is what keeps it inside Radix's pointer-events/scroll-lock/outside-
// click boundaries automatically.
describe("ManagerSelect — inside a real (unmocked) Dialog", () => {
  beforeAll(() => {
    // Radix's DismissableLayer/FocusScope need pointer-capture APIs jsdom
    // doesn't implement.
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = () => false;
    }
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = () => {};
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = () => {};
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    latestSelectProps = undefined;
    mockGet.mockResolvedValue({
      ok: true,
      status: 200,
      data: { data: [], pageCount: 1, currentPage: 1, total: 0 },
    });
  });

  it("renders as a real DOM descendant of DialogContent, still with no portal target", async () => {
    function Harness() {
      const form = useForm<FormValues>({ defaultValues: { manager_id: undefined } });
      return (
        <Dialog open>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Crear Marca</DialogTitle>
            <Form {...form}>
              <ManagerSelect form={form} control={form.control} name="manager_id" clientId={5} />
            </Form>
          </DialogContent>
        </Dialog>
      );
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>
    );

    await waitFor(() => expect(latestSelectProps).toBeDefined());

    const dialogNode = screen.getByRole("dialog");
    const managerSelectNode = screen.getByTestId("manager-select");
    expect(dialogNode.contains(managerSelectNode)).toBe(true);

    // Still no portal props — the select is inside the dialog purely by
    // normal React/DOM composition, not via any menuPortalTarget wiring.
    expect(latestSelectProps.menuPortalTarget).toBeUndefined();
    expect(latestSelectProps.menuPosition).toBeUndefined();
    expect(latestSelectProps.menuPlacement).toBe("bottom");
    expect(latestSelectProps.maxMenuHeight).toBe(240);
  });
});
