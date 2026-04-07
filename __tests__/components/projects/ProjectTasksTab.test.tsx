import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (String(queryKey[0]) === "project-tasks") {
      return {
        data: [
          {
            id: 11,
            project_id: 7,
            template_id: null,
            title: "Subir artes finales",
            description: null,
            area_id: null,
            area_name: null,
            assigned_user_id: 4,
            assigned_user_name: "Vale",
            assigned_user_rol_id: 4,
            assigned_user_is_internal: 1,
            status: "completed",
            task_type: "execution",
            task_flag: "new",
            adjustment_id: null,
            requires_quote: 0,
            assign_to_commercial: 0,
            order_index: 0,
            created_at: "2026-04-07T00:00:00.000Z",
            updated_at: "2026-04-07T00:00:00.000Z",
            delivery_url: "https://example.com/final",
            delivery_notes: "<p>Entrega publicada</p>",
            completion_cost: null,
            progress_percent: 100,
            progress_minutes: 30,
            quoter_ids: [],
            quote_count: 0,
            pending_quote_count: 0,
          },
        ],
        isLoading: false,
        isFetching: false,
        refetch: jest.fn(),
        dataUpdatedAt: Date.now(),
      };
    }

    return {
      data: [],
      isLoading: false,
      isFetching: false,
      refetch: jest.fn(),
      dataUpdatedAt: Date.now(),
    };
  },
}));

jest.mock("@/lib/services/apiService", () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  del: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/components/tasks/TaskValidationDialog", () => ({
  TaskValidationDialog: () => null,
}));

jest.mock("@/components/tasks/TaskCompleteDialog", () => ({
  TaskCompleteDialog: () => null,
}));

jest.mock("@/components/tasks/TaskHistoryDialog", () => ({
  TaskHistoryDialog: () => null,
}));

jest.mock("@/components/tasks/TaskAssignmentSelector", () => ({
  TaskAssignmentSelector: () => null,
}));

jest.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

jest.mock("@/components/ui/form", () => ({
  Form: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormControl: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormField: () => null,
  FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
  FormMessage: () => null,
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/checkbox", () => ({ Checkbox: () => null }));
jest.mock("@/components/ui/input", () => ({ Input: () => <input /> }));
jest.mock("@/components/ui/textarea", () => ({ Textarea: () => <textarea /> }));
jest.mock("@/components/ui/skeleton", () => ({ Skeleton: () => <div>loading</div> }));
jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/components/ui/badge", () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));

jest.mock("@/components/ui/sortable-list", () => ({
  SortableList: ({ items, renderItem }: { items: unknown[]; renderItem: (item: any) => React.ReactNode }) => (
    <div>{items.map((item: any) => <div key={item.id}>{renderItem(item)}</div>)}</div>
  ),
}));

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

import { ProjectTasksTab } from "@/components/projects/ProjectTasksTab";

describe("ProjectTasksTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens the read-only deliverable dialog from the new eye button", async () => {
    const user = userEvent.setup();

    render(
      <ProjectTasksTab
        projectId={7}
        productName="Producto"
        canEdit={false}
        currentUserId={4}
        currentUserRole={4}
      />
    );

    await user.click(screen.getByRole("button", { name: /ver entregable de subir artes finales/i }));

    expect(screen.getByText(/ver entregable/i)).toBeInTheDocument();
    expect(screen.getByText("https://example.com/final")).toBeInTheDocument();
    expect(screen.getByText(/entrega publicada/i)).toBeInTheDocument();
  });
});
