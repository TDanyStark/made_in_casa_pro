import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProjectAdjustmentsTab } from '@/components/projects/ProjectAdjustmentsTab';

jest.mock('lucide-react', () => ({ Plus: () => null, ExternalLink: () => null, HardDrive: () => null, ChevronDown: () => null, ChevronUp: () => null, Trash2: () => null }));
const mockVersions = [{ id: 1, version_number: 1, status: 'completed', created_at: '2026-01-01', task_count: 2 }];
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
