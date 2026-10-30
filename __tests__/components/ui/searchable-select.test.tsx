import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchableSelect } from "@/components/ui/searchable-select";

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = jest.fn();
});

function open(options: React.ComponentProps<typeof SearchableSelect>["options"]) {
  render(<SearchableSelect options={options} value="all" onValueChange={jest.fn()} />);
  fireEvent.click(screen.getByRole("combobox"));
}

describe("SearchableSelect groups", () => {
  it("renders a heading per group, in the given order", () => {
    open([
      { value: "all", label: "Todos" },
      { value: "1", label: "Ana", group: "Comerciales" },
      { value: "2", label: "Bruno", group: "Directivos" },
      { value: "3", label: "Zoe", group: "Admins" },
    ]);

    const headings = Array.from(document.querySelectorAll("[cmdk-group-heading]")).map((h) => h.textContent);
    expect(headings).toEqual(["Comerciales", "Directivos", "Admins"]);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Todos", "Ana", "Bruno", "Zoe"]);
  });

  it("keeps ungrouped options in a single group without heading", () => {
    open([
      { value: "a", label: "Uno" },
      { value: "b", label: "Dos" },
    ]);

    expect(document.querySelectorAll("[cmdk-group]")).toHaveLength(1);
    expect(document.querySelectorAll("[cmdk-group-heading]")).toHaveLength(0);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Uno", "Dos"]);
  });
});
