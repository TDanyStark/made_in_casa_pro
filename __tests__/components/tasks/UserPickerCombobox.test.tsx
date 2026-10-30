import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { UserPickerCombobox, AssignableUserOption } from "@/components/tasks/UserPickerCombobox";

jest.mock("@/lib/services/apiService", () => ({ get: jest.fn() }));
jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }));

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

const users: AssignableUserOption[] = [
  { id: 1, name: "Nataly Pinilla", rol_id: 4, is_internal: 1, area_name: "Diseño", active_task_count: 6 },
  { id: 2, name: "Laura Obregoso", rol_id: 4, is_internal: 0, area_name: "Diseño", active_task_count: 0 },
  { id: 3, name: "Lina Gonzalez", rol_id: 4, is_internal: 0, area_name: "Escritura", active_task_count: 4 },
  { id: 4, name: "Admin Uno", rol_id: 1, is_internal: 1, area_name: null, active_task_count: 0 },
];

function open() {
  fireEvent.click(screen.getByRole("combobox"));
  return screen.getByRole("listbox");
}

describe("UserPickerCombobox", () => {
  it("groups people by area, shows internal/external and the task count", () => {
    render(<UserPickerCombobox users={users} value={null} onChange={jest.fn()} />);
    const list = within(open());

    expect(list.getByText("Diseño")).toBeInTheDocument();
    expect(list.getByText("Escritura")).toBeInTheDocument();
    expect(list.getByText("Sin área")).toBeInTheDocument();
    const nataly = list.getByRole("option", { name: /Nataly Pinilla/ });
    expect(within(nataly).getByText("6 tarea(s)")).toBeInTheDocument();
    expect(within(nataly).getByText("Interno")).toBeInTheDocument();
    expect(within(list.getByRole("option", { name: /Lina Gonzalez/ })).getByText("Externo")).toBeInTheDocument();
    // Non-collaborators show their role instead of internal/external
    expect(within(list.getByRole("option", { name: /Admin Uno/ })).getByText("Admin")).toBeInTheDocument();
  });

  it("lists internals before externals inside an area", () => {
    render(<UserPickerCombobox users={users} value={null} onChange={jest.fn()} />);
    const names = within(open())
      .getAllByRole("option")
      .map((o) => o.textContent ?? "");
    expect(names.findIndex((n) => n.includes("Nataly"))).toBeLessThan(names.findIndex((n) => n.includes("Laura")));
  });

  it("shows the selected person with area and internal/external on the trigger", () => {
    render(<UserPickerCombobox users={users} value={3} onChange={jest.fn()} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Lina Gonzalez");
    expect(trigger).toHaveTextContent("· Escritura");
    expect(trigger).toHaveTextContent("Externo");
  });

  it("selects a person by id", () => {
    const onChange = jest.fn();
    render(<UserPickerCombobox users={users} value={null} onChange={onChange} />);
    fireEvent.click(within(open()).getByRole("option", { name: /Laura Obregoso/ }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("offers 'Sin asignar' only when allowed and selects null", () => {
    const onChange = jest.fn();
    const { unmount } = render(<UserPickerCombobox users={users} value={1} onChange={onChange} />);
    expect(within(open()).queryByRole("option", { name: /Sin asignar/ })).not.toBeInTheDocument();
    unmount();

    render(<UserPickerCombobox users={users} value={1} onChange={onChange} allowUnassigned />);
    fireEvent.click(within(open()).getByRole("option", { name: /Sin asignar/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows 'Sin asignar' on the trigger when unassigned is allowed and nothing is selected", () => {
    render(<UserPickerCombobox users={users} value={null} onChange={jest.fn()} allowUnassigned />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Sin asignar");
  });
});
