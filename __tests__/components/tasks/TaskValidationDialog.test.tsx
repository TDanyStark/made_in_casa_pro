/**
 * 5.10 — UI test for TaskValidationDialog
 *
 * Verifies that the component submits `targetTaskId` (not `target_order_index`)
 * in the POST payload when the user rejects a validation task.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ── Mocks (before imports) ──────────────────────────────────────────────────

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

// Mock apiService — we capture what post() receives
jest.mock('@/lib/services/apiService', () => ({
  post: jest.fn(),
}));

// Mock dynamic import (RichTextEditor) — replace with a simple textarea
jest.mock('next/dynamic', () => (fn: unknown) => {
  const MockRichTextEditor = ({ onChange, value }: { onChange: (v: string) => void; value: string }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  MockRichTextEditor.displayName = 'MockRichTextEditor';
  return MockRichTextEditor;
});

// Mock lucide-react icons to avoid ESM issues
jest.mock('lucide-react', () => ({
  ShieldCheck: () => <span data-testid="icon-shield" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  ChevronDown: () => <span data-testid="icon-chevron" />,
  Loader2: () => <span data-testid="icon-loader" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
}));

// Mock shadcn Dialog components to avoid radix-ui portal issues in JSDOM
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-title">{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-footer">{children}</div>,
}));

// Mock shadcn Select components — controlled: onValueChange receives the value directly
jest.mock('@/components/ui/select', () => {
  const SelectContext = React.createContext<{ onValueChange?: (v: string) => void }>({});
  
  const Select = ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (v: string) => void }) => (
    <SelectContext.Provider value={{ onValueChange }}>
      <div data-testid="select" data-value={value}>{children}</div>
    </SelectContext.Provider>
  );

  const SelectTrigger = ({ children }: { children: React.ReactNode }) =>
    <div data-testid="select-trigger">{children}</div>;

  const SelectValue = ({ placeholder }: { placeholder?: string }) =>
    <span data-testid="select-value">{placeholder}</span>;

  const SelectContent = ({ children }: { children: React.ReactNode }) =>
    <div data-testid="select-content">{children}</div>;

  const SelectItem = ({ children, value }: { children: React.ReactNode; value: string }) => {
    const ctx = React.useContext(SelectContext);
    return (
      <div
        data-testid={`select-item-${value}`}
        data-value={value}
        onClick={() => ctx.onValueChange?.(value)}
        role="option"
      >
        {children}
      </div>
    );
  };

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

// Mock shadcn Button
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, type }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    type?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className} type={type as never}>
      {children}
    </button>
  ),
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { TaskValidationDialog } from '@/components/tasks/TaskValidationDialog';
import { post } from '@/lib/services/apiService';

const mockPost = post as jest.MockedFunction<typeof post>;

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    project_id: 1,
    template_id: null,
    title: 'Review the Design',
    description: null,
    area_id: 2,
    area_name: 'Design',
    assigned_user_id: 5,
    assigned_user_name: 'Alice',
    assigned_user_rol_id: 4,
    status: 'in_progress',
    task_type: 'validation',
    task_flag: 'new',
    requires_quote: 0,
    assign_to_commercial: 0,
    order_index: 3,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    quote_count: 0,
    pending_quote_count: 0,
    ...overrides,
  } as never;
}

function makeSiblingTasks() {
  return [
    // Task with id=7, order_index=2 (before validation task at order_index=3)
    makeTask({ id: 7, order_index: 2, title: 'Do the Work', task_type: 'execution', assigned_user_name: null }),
    // Task with id=8, order_index=1 (before validation task at order_index=3)
    makeTask({ id: 8, order_index: 1, title: 'Plan the Work', task_type: 'execution', assigned_user_name: null }),
    // The validation task itself (should be filtered out in dropdown)
    makeTask({ id: 10, order_index: 3, title: 'Review the Design', task_type: 'validation' }),
  ] as never[];
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TaskValidationDialog — 5.10 targetTaskId in payload', () => {
  it('5.10 — sends targetTaskId (number = task.id) in POST body on reject submit', async () => {
    mockPost.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { task: makeTask({ status: 'completed' }), targetTask: null },
    } as never);

    const onSuccess = jest.fn();
    const onOpenChange = jest.fn();

    render(
      <TaskValidationDialog
        open={true}
        onOpenChange={onOpenChange}
        task={makeTask()}
        siblings={makeSiblingTasks()}
        onSuccess={onSuccess}
      />
    );

    // Click "Rechazar" to switch to reject mode
    // The component renders two buttons: Aprobar and Rechazar
    const rejectButton = screen.getAllByRole('button').find(btn =>
      btn.textContent?.includes('Rechazar') && !btn.textContent?.includes('y enviar')
    );
    expect(rejectButton).toBeDefined();
    fireEvent.click(rejectButton!);

    // Fill in the notes field (required for rejection)
    const notesEditor = screen.getByTestId('rich-text-editor');
    fireEvent.change(notesEditor, { target: { value: 'Please fix the design errors.' } });

    // Select target task — click the SelectItem for task id=7
    // In our mock, SelectItem is a div with data-testid="select-item-7"
    const selectItem = screen.getByTestId('select-item-7');
    fireEvent.click(selectItem);

    // Click submit button
    const submitButton = screen.getAllByRole('button').find(btn =>
      btn.textContent?.includes('y enviar')
    );
    expect(submitButton).toBeDefined();

    await act(async () => {
      fireEvent.click(submitButton!);
    });

    // Verify post() was called with targetTaskId as a number (task.id = 7)
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    });

    const [endpoint, body] = mockPost.mock.calls[0];
    expect(endpoint).toContain('validate');
    expect(body).toHaveProperty('targetTaskId');
    expect(typeof body.targetTaskId).toBe('number');
    expect(body.targetTaskId).toBe(7);  // task.id=7 (not order_index=2)
  });

  it('5.10 — does NOT send target_order_index in the payload', async () => {
    mockPost.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { task: makeTask({ status: 'completed' }), targetTask: null },
    } as never);

    render(
      <TaskValidationDialog
        open={true}
        onOpenChange={jest.fn()}
        task={makeTask()}
        siblings={makeSiblingTasks()}
        onSuccess={jest.fn()}
      />
    );

    // Switch to reject mode
    const rejectButton = screen.getAllByRole('button').find(btn =>
      btn.textContent?.includes('Rechazar') && !btn.textContent?.includes('y enviar')
    );
    fireEvent.click(rejectButton!);

    // Fill notes
    const notesEditor = screen.getByTestId('rich-text-editor');
    fireEvent.change(notesEditor, { target: { value: 'Fix required.' } });

    // Select target task id=7
    fireEvent.click(screen.getByTestId('select-item-7'));

    const submitButton = screen.getAllByRole('button').find(btn =>
      btn.textContent?.includes('y enviar')
    );

    await act(async () => {
      fireEvent.click(submitButton!);
    });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    });

    const [, body] = mockPost.mock.calls[0];
    // The old field name must NOT be present
    expect(body).not.toHaveProperty('target_order_index');
  });

  it('5.10 — sends action="reject" in the payload', async () => {
    mockPost.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {},
    } as never);

    render(
      <TaskValidationDialog
        open={true}
        onOpenChange={jest.fn()}
        task={makeTask()}
        siblings={makeSiblingTasks()}
        onSuccess={jest.fn()}
      />
    );

    // Switch to reject mode
    const rejectButton = screen.getAllByRole('button').find(btn =>
      btn.textContent?.includes('Rechazar') && !btn.textContent?.includes('y enviar')
    );
    fireEvent.click(rejectButton!);

    // Fill notes
    const notesEditor = screen.getByTestId('rich-text-editor');
    fireEvent.change(notesEditor, { target: { value: 'Fix required.' } });

    // Select task id=7
    fireEvent.click(screen.getByTestId('select-item-7'));

    const submitButton = screen.getAllByRole('button').find(btn =>
      btn.textContent?.includes('y enviar')
    );

    await act(async () => {
      fireEvent.click(submitButton!);
    });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    });

    const [, body] = mockPost.mock.calls[0];
    expect(body.action).toBe('reject');
  });

  it('5.10 — does not send targetTaskId on approve', async () => {
    mockPost.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {},
    } as never);

    render(
      <TaskValidationDialog
        open={true}
        onOpenChange={jest.fn()}
        task={makeTask()}
        siblings={makeSiblingTasks()}
        onSuccess={jest.fn()}
      />
    );

    // Default action is "approve" — just click the submit button
    // Find the "Aprobar y enviar" button
    const submitButton = screen.getAllByRole('button').find(btn =>
      btn.textContent?.includes('Aprobar y enviar')
    );
    expect(submitButton).toBeDefined();

    await act(async () => {
      fireEvent.click(submitButton!);
    });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    });

    const [, body] = mockPost.mock.calls[0];
    expect(body.action).toBe('approve');
    expect(body).not.toHaveProperty('targetTaskId');
  });
});
