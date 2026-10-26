import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { get } from '@/lib/services/apiService';
import { AdjustmentWizard } from '@/components/projects/AdjustmentWizard';
import { WizardStep4Tasks } from '@/components/projects/wizard/WizardStep4Tasks';
import { UserRole } from '@/lib/definitions';
import { apiFailure, renderWithQueryClient } from '../queryTestUtils';

jest.mock('@/lib/services/apiService', () => ({ get: jest.fn() }));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));
jest.mock('next/dynamic', () => () => () => null);
jest.mock('@/components/projects/shared/ProjectTaskEditor', () => ({
  ProjectTaskEditorList: ({ tasks }: { tasks: unknown[] }) => <div>lista ({tasks.length})</div>,
  TaskSettingsDialog: () => null,
  deriveAssignMode: () => 'auto',
  resolveAssigneeName: () => null,
}));

const mockGet = get as jest.Mock;

describe('task template load errors in wizards', () => {
  beforeEach(() => mockGet.mockResolvedValue(apiFailure));
  afterEach(() => mockGet.mockReset());

  it('WizardStep4Tasks shows an error and blocks Siguiente instead of an empty task list', async () => {
    renderWithQueryClient(
      <WizardStep4Tasks
        state={{ product: { id: 3, name: 'Prod' }, task_overrides: [], extra_tasks: [], removed_template_ids: [] } as never}
        onNext={jest.fn()}
        onBack={jest.fn()}
        update={jest.fn()}
      />
    );
    expect(await screen.findByText('Error al cargar las tareas del producto')).toBeInTheDocument();
    expect(screen.queryByText('lista (0)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('AdjustmentWizard shows an error and blocks Crear Ajuste instead of an empty task list', async () => {
    renderWithQueryClient(
      <AdjustmentWizard
        open
        onOpenChange={jest.fn()}
        projectId={1}
        productId={3}
        userRole={UserRole.ADMIN}
        onConfirm={jest.fn()}
        isSubmitting={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Siguiente — Tareas/ }));
    expect(await screen.findByText('Error al cargar las tareas del producto')).toBeInTheDocument();
    expect(screen.queryByText('lista (0)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear Ajuste/ })).toBeDisabled();
  });
});
