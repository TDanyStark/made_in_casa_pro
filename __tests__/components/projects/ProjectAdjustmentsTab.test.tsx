import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProjectAdjustmentsTab } from '@/components/projects/ProjectAdjustmentsTab';

jest.mock('lucide-react', () => ({ Plus: () => null, ExternalLink: () => null, HardDrive: () => null, ChevronDown: () => null, ChevronUp: () => null, Trash2: () => null }));
type MockVersion = { id: number; version_number: number; status: string; created_at: string; task_count?: number | string; completed_task_count?: number | string };
const baseVersion: MockVersion = { id: 1, version_number: 1, status: 'completed', created_at: '2026-01-01', task_count: 2, completed_task_count: 2 };
const mockVersions: MockVersion[] = [baseVersion];
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mockVersions, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('@/lib/services/apiService', () => ({ get: jest.fn(), post: jest.fn(), del: jest.fn() }));
jest.mock('@/components/projects/AdjustmentWizard', () => ({ AdjustmentWizard: () => null }));
jest.mock('@/components/projects/ProjectTasksTab', () => ({
  ProjectTasksTab: ({ canCreateTask, canEdit }: { canCreateTask: boolean; canEdit: boolean }) => (
    <div>{canCreateTask && <button>Agregar tarea</button>}{canEdit && <span>Edición habilitada</span>}</div>
  ),
}));

const props = { projectId: 1, projectStatus: 'completed', productId: 1, productName: 'Producto', canEdit: true, currentUserRole: 1 as const };

describe('completed project task choices', () => {
  it('offers another task in the latest completed version and a separate adjustment', () => {
    render(<ProjectAdjustmentsTab {...props} />);
    expect(screen.getByRole('button', { name: 'Agregar tarea' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear ajuste' })).toBeInTheDocument();
    expect(screen.queryByText('Edición habilitada')).not.toBeInTheDocument();
  });
  it('keeps historical versions read-only when a newer version exists', () => {
    mockVersions.push({ ...mockVersions[0], id: 2, version_number: 2 });
    try {
      render(<ProjectAdjustmentsTab {...props} />);
      fireEvent.click(screen.getByText('Versión 1 (Original)'));
      expect(screen.getAllByRole('button', { name: 'Agregar tarea' })).toHaveLength(1);
    } finally {
      mockVersions.pop();
    }
  });
  it('does not grant creation to read-only users', () => {
    render(<ProjectAdjustmentsTab {...props} canEdit={false} />);
    expect(screen.queryByRole('button', { name: 'Agregar tarea' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear ajuste' })).not.toBeInTheDocument();
  });
  it('does not offer task creation in paused projects', () => {
    render(<ProjectAdjustmentsTab {...props} projectStatus="paused" />);
    expect(screen.queryByRole('button', { name: 'Agregar tarea' })).not.toBeInTheDocument();
  });
});

describe('new adjustment eligibility from real latest-version tasks', () => {
  const useVersions = (versions: MockVersion[]) => mockVersions.splice(0, mockVersions.length, ...versions);
  afterEach(() => useVersions([baseVersion]));

  it.each(['active', 'in_adjustments', 'completed'])('offers Crear ajuste in a %s project when every latest task is completed', (projectStatus) => {
    useVersions([{ ...baseVersion, status: 'active', task_count: '3', completed_task_count: '3' }]);
    render(<ProjectAdjustmentsTab {...props} projectStatus={projectStatus} />);
    expect(screen.getByRole('button', { name: 'Crear ajuste' })).toBeInTheDocument();
  });

  it('hides Crear ajuste when the latest version has unfinished tasks despite completed statuses', () => {
    useVersions([{ ...baseVersion, status: 'completed', task_count: 3, completed_task_count: 2 }]);
    render(<ProjectAdjustmentsTab {...props} projectStatus="completed" />);
    expect(screen.queryByRole('button', { name: 'Crear ajuste' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar tarea' })).toBeInTheDocument();
  });

  it('hides Crear ajuste when the latest version is empty', () => {
    useVersions([{ ...baseVersion, status: 'completed', task_count: 0, completed_task_count: 0 }]);
    render(<ProjectAdjustmentsTab {...props} projectStatus="completed" />);
    expect(screen.queryByRole('button', { name: 'Crear ajuste' })).not.toBeInTheDocument();
  });

  it('hides Crear ajuste when the project has no version', () => {
    useVersions([]);
    render(<ProjectAdjustmentsTab {...props} projectStatus="completed" />);
    expect(screen.queryByRole('button', { name: 'Crear ajuste' })).not.toBeInTheDocument();
  });

  it('decides with the latest version only, not older completed ones', () => {
    useVersions([
      { ...baseVersion, id: 1, version_number: 1, task_count: 2, completed_task_count: 2 },
      { ...baseVersion, id: 2, version_number: 2, status: 'completed', task_count: 2, completed_task_count: 1 },
    ]);
    render(<ProjectAdjustmentsTab {...props} projectStatus="completed" />);
    expect(screen.queryByRole('button', { name: 'Crear ajuste' })).not.toBeInTheDocument();
  });
});
