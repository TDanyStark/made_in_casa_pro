import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProjectAdjustmentsTab } from '@/components/projects/ProjectAdjustmentsTab';

jest.mock('lucide-react', () => ({ Plus: () => null, ExternalLink: () => null, HardDrive: () => null, ChevronDown: () => null, ChevronUp: () => null, Trash2: () => null, Search: () => null }));

const mockVersions = [
  { id: 1, version_number: 1, status: 'completed', created_at: '2026-01-01', task_count: 2, completed_task_count: 2 },
  { id: 2, version_number: 2, status: 'completed', created_at: '2026-02-01', task_count: 1, completed_task_count: 1 },
  { id: 3, version_number: 3, status: 'active', created_at: '2026-03-01', task_count: 1, completed_task_count: 0 },
];
const mockAllTasks = [
  { id: 10, adjustment_id: 1, title: 'Diseño de logo', assigned_user_name: 'María Pérez' },
  { id: 11, adjustment_id: 1, title: 'Copy', assigned_user_name: 'Andrés' },
  { id: 20, adjustment_id: 2, title: 'Ajuste de logo', assigned_user_name: 'Andrés' },
  { id: 30, adjustment_id: 3, title: 'Video', assigned_user_name: 'Luisa' },
];
const mockQueryCalls: { queryKey: unknown[]; enabled?: boolean }[] = [];

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: unknown[]; enabled?: boolean }) => {
    mockQueryCalls.push(options);
    if (options.queryKey[0] === 'project-tasks-search') {
      return { data: options.enabled === false ? undefined : mockAllTasks, isLoading: false };
    }
    return { data: mockVersions, isLoading: false };
  },
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('@/lib/services/apiService', () => ({ get: jest.fn(), post: jest.fn(), del: jest.fn() }));
jest.mock('@/components/projects/AdjustmentWizard', () => ({ AdjustmentWizard: () => null }));
jest.mock('@/components/projects/ProjectTasksTab', () => ({
  ProjectTasksTab: ({ adjustmentId, searchQuery }: { adjustmentId: number; searchQuery?: string }) => (
    <div data-testid={`tasks-${adjustmentId}`}>{searchQuery ?? ''}</div>
  ),
}));

const props = { projectId: 1, projectStatus: 'active', productId: 1, productName: 'Producto', canEdit: true, currentUserRole: 1 as const };

describe('ProjectAdjustmentsTab — search across versions', () => {
  beforeEach(() => {
    mockQueryCalls.length = 0;
  });

  it('shows every version and loads no project-wide tasks while the search is empty', () => {
    render(<ProjectAdjustmentsTab {...props} />);

    expect(screen.getByText('Versión 3')).toBeInTheDocument();
    expect(screen.getByText('Versión 2')).toBeInTheDocument();
    expect(screen.getByText('Versión 1 (Original)')).toBeInTheDocument();
    expect(screen.getByTestId('tasks-3')).toBeInTheDocument();
    expect(screen.queryByTestId('tasks-1')).not.toBeInTheDocument();
    const searchCall = mockQueryCalls.find((c) => c.queryKey[0] === 'project-tasks-search');
    expect(searchCall?.enabled).toBe(false);
  });

  it('keeps only the versions with matching tasks, expanded and filtered by the query', () => {
    render(<ProjectAdjustmentsTab {...props} />);

    fireEvent.change(screen.getByPlaceholderText('Buscar por tarea o colaborador...'), { target: { value: 'logo' } });

    expect(screen.queryByText('Versión 3')).not.toBeInTheDocument();
    expect(screen.getByTestId('tasks-2')).toHaveTextContent('logo');
    expect(screen.getByTestId('tasks-1')).toHaveTextContent('logo');
  });

  it('matches versions by collaborator name', () => {
    render(<ProjectAdjustmentsTab {...props} />);

    fireEvent.change(screen.getByPlaceholderText('Buscar por tarea o colaborador...'), { target: { value: 'luisa' } });

    expect(screen.getByTestId('tasks-3')).toBeInTheDocument();
    expect(screen.queryByText('Versión 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Versión 1 (Original)')).not.toBeInTheDocument();
  });

  it('shows a no-results message when no task matches', () => {
    render(<ProjectAdjustmentsTab {...props} />);

    fireEvent.change(screen.getByPlaceholderText('Buscar por tarea o colaborador...'), { target: { value: 'zzz' } });

    expect(screen.getByText('Ninguna tarea coincide con "zzz".')).toBeInTheDocument();
    expect(screen.queryByText(/^Versión/)).not.toBeInTheDocument();
  });
});

describe('ProjectAdjustmentsTab — clearing the search', () => {
  it('restores every version with only the latest one expanded', () => {
    render(<ProjectAdjustmentsTab {...props} />);
    const input = screen.getByPlaceholderText('Buscar por tarea o colaborador...');

    fireEvent.change(input, { target: { value: 'logo' } });
    expect(screen.getByTestId('tasks-1')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText('Versión 3')).toBeInTheDocument();
    expect(screen.getByTestId('tasks-3')).toHaveTextContent('');
    expect(screen.queryByTestId('tasks-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tasks-1')).not.toBeInTheDocument();
  });
});

describe('ProjectAdjustmentsTab — user toggles', () => {
  it('keeps a version the user collapsed during a search collapsed while typing', () => {
    render(<ProjectAdjustmentsTab {...props} />);
    const input = screen.getByPlaceholderText('Buscar por tarea o colaborador...');
    fireEvent.change(input, { target: { value: 'lo' } });
    expect(screen.getByTestId('tasks-2')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Versión 2'));
    expect(screen.queryByTestId('tasks-2')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'logo' } });
    expect(screen.queryByTestId('tasks-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('tasks-1')).toBeInTheDocument();
  });

  it('keeps a version the user expanded outside search open across rerenders', () => {
    const { rerender } = render(<ProjectAdjustmentsTab {...props} />);
    fireEvent.click(screen.getByText('Versión 1 (Original)'));
    expect(screen.getByTestId('tasks-1')).toBeInTheDocument();
    rerender(<ProjectAdjustmentsTab {...props} canEdit={false} />);
    expect(screen.getByTestId('tasks-1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Versión 3'));
    expect(screen.queryByTestId('tasks-3')).not.toBeInTheDocument();
  });

  it('treats a whitespace-only query as no search', () => {
    render(<ProjectAdjustmentsTab {...props} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar por tarea o colaborador...'), { target: { value: '   ' } });
    expect(screen.getByText('Versión 1 (Original)')).toBeInTheDocument();
    expect(screen.queryByTestId('tasks-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('tasks-3')).toHaveTextContent('');
  });
});
