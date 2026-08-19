import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${String(iconName)}`} />;
    MockIcon.displayName = String(iconName);
    return MockIcon;
  },
}));

// Radix's DismissableLayer relies on pointer-capture APIs jsdom doesn't
// implement. Real browsers have them; without a stub, `pointerdown` inside
// Content throws before we ever reach the outside-click logic under test.
beforeAll(() => {
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

function renderDialog(onOpenChange: (open: boolean) => void) {
  render(
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Crear Marca</DialogTitle>
        <input placeholder="dentro-del-dialog" />
      </DialogContent>
    </Dialog>
  );
}

// Radix's DismissableLayer registers its document-level `pointerdown`
// listener inside a `setTimeout(0)` (to skip the pointerdown that may have
// opened the layer itself). Tests must let that timer flush before firing
// the outside pointerdown, otherwise nothing is listening yet.
const flushRadixListenerSetup = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe("DialogContent — react-select portal outside-click guard", () => {
  it("does NOT close when the pointer-down target lives inside a react-select menu portal", async () => {
    const onOpenChange = jest.fn();
    renderDialog(onOpenChange);
    await flushRadixListenerSetup();

    // Simulate what react-select renders when `menuPortalTarget={document.body}`
    // + `classNamePrefix="react-select"` are set: a sibling node under body,
    // outside DialogContent's own DOM subtree, carrying the portal class.
    const portalMenu = document.createElement("div");
    portalMenu.className = "react-select__menu-portal";
    const option = document.createElement("div");
    option.textContent = "Opción de país";
    portalMenu.appendChild(option);
    document.body.appendChild(portalMenu);

    fireEvent.pointerDown(option);

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByPlaceholderText("dentro-del-dialog")).toBeInTheDocument();

    document.body.removeChild(portalMenu);
  });

  it("still closes on a genuine outside click (unrelated to react-select)", async () => {
    const onOpenChange = jest.fn();
    renderDialog(onOpenChange);
    await flushRadixListenerSetup();

    const outside = document.createElement("button");
    outside.textContent = "fuera del dialog";
    document.body.appendChild(outside);

    fireEvent.pointerDown(outside);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    document.body.removeChild(outside);
  });
});
