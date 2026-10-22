import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockPost = jest.fn();
jest.mock("@/lib/services/apiService", () => ({
  post: (...args: unknown[]) => mockPost(...args),
}));

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

import {
  TaskPauseResumeButton,
  notifyAutoPaused,
} from "@/components/tasks/TaskPauseResumeButton";

import { toast } from "sonner";
const mockToast = toast as unknown as Record<"success" | "error" | "info", jest.Mock>;

const baseTask = { id: 10, project_id: 1, title: "Diseño" };

beforeEach(() => jest.clearAllMocks());

describe("TaskPauseResumeButton", () => {
  it("shows Pausar for an in-progress task and calls the pause endpoint", async () => {
    const onChanged = jest.fn();
    mockPost.mockResolvedValue({ ok: true, data: { message: "Tarea pausada correctamente" } });

    render(<TaskPauseResumeButton task={{ ...baseTask, status: "in_progress" }} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith("projects/1/tasks/10/pause", {});
    expect(mockToast.success).toHaveBeenCalledWith("Tarea pausada correctamente");
  });

  it("shows Reanudar for a paused task and reports the task paused automatically", async () => {
    const onChanged = jest.fn();
    mockPost.mockResolvedValue({ ok: true, data: { message: "Tarea reanudada correctamente", pausedTaskIds: [20] } });

    render(<TaskPauseResumeButton task={{ ...baseTask, status: "paused" }} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Reanudar" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith("projects/1/tasks/10/resume", {});
    expect(mockToast.success).toHaveBeenCalledWith("Tarea reanudada correctamente");
    expect(mockToast.info).toHaveBeenCalledWith("Se pausó automáticamente 1 tarea que estaba en progreso");
  });

  it("shows the API error and does not refresh on failure", async () => {
    const onChanged = jest.fn();
    mockPost.mockResolvedValue({ ok: false, error: "Solo se pueden pausar tareas en progreso" });

    render(<TaskPauseResumeButton task={{ ...baseTask, status: "in_progress" }} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Solo se pueden pausar tareas en progreso"));
    expect(onChanged).not.toHaveBeenCalled();
  });

  it.each(["not_started", "waiting", "completed", "blocked"] as const)("renders nothing for %s", (status) => {
    const { container } = render(<TaskPauseResumeButton task={{ ...baseTask, status }} onChanged={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("notifyAutoPaused", () => {
  it("is silent for no paused tasks and pluralizes for several", () => {
    notifyAutoPaused(undefined);
    notifyAutoPaused([]);
    expect(mockToast.info).not.toHaveBeenCalled();

    notifyAutoPaused([1, 2, 3]);
    expect(mockToast.info).toHaveBeenCalledWith("Se pausaron automáticamente 3 tareas que estaban en progreso");
  });
});
