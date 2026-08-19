import { render, fireEvent, waitFor } from "@testing-library/react";
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

describe("DialogContent — outside click closes the dialog", () => {
  it("closes on a genuine outside click", async () => {
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
