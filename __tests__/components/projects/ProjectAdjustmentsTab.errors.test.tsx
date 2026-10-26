import { screen } from '@testing-library/react';
import { get } from '@/lib/services/apiService';
import { ProjectAdjustmentsTab } from '@/components/projects/ProjectAdjustmentsTab';
import { UserRole } from '@/lib/definitions';
import { apiFailure, renderWithQueryClient } from '../queryTestUtils';

jest.mock('@/lib/services/apiService', () => ({ get: jest.fn(), post: jest.fn(), del: jest.fn() }));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/projects/AdjustmentWizard', () => ({ AdjustmentWizard: () => null }));
jest.mock('@/components/projects/ProjectTasksTab', () => ({ ProjectTasksTab: () => null }));

const mockGet = get as jest.Mock;
const props = {
  projectId: 1, projectStatus: 'active', productId: 1, productName: 'P', canEdit: true,
  currentUserRole: UserRole.ADMIN,
};

describe('ProjectAdjustmentsTab load errors', () => {
  afterEach(() => mockGet.mockReset());

  it('shows an error state and no "Crear ajuste" when adjustments fail to load', async () => {
    mockGet.mockResolvedValue(apiFailure);
    renderWithQueryClient(<ProjectAdjustmentsTab {...props} />);
    expect(await screen.findByText('Error al cargar las tareas y versiones')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear ajuste' })).not.toBeInTheDocument();
  });

  it('renders adjustment notes sanitized', async () => {
    mockGet.mockResolvedValue({
      ok: true, status: 200,
      data: [{ id: 1, version_number: 1, status: 'active', created_at: '2026-01-01', task_count: 0,
        notes: '<p><s>nota</s></p><script>alert(1)</script>' }],
    });
    const { container } = renderWithQueryClient(<ProjectAdjustmentsTab {...props} />);
    expect((await screen.findByText('nota')).tagName).toBe('S');
    expect(container.querySelector('script')).toBeNull();
  });
});
