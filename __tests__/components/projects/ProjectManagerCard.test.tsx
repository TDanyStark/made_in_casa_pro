// Spec: odd/tasks/brand-owned-project-manager.md — S3
import { screen } from '@testing-library/react';
import { ProjectManagerCard } from '@/components/projects/ProjectManagerCard';
import { ProjectDetailType } from '@/lib/definitions';
import { renderWithQueryClient } from '../queryTestUtils';

const mockGet = jest.fn();
const mockPatch = jest.fn();

jest.mock('lucide-react', () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

jest.mock('@/lib/services/apiService', () => ({
  get: (...args: unknown[]) => mockGet(...args),
  patch: (...args: unknown[]) => mockPatch(...args),
}));

const project = {
  id: 10,
  title: 'Nulytelly 2026',
  brand_id: 5,
  brand_name: 'Nulytelly',
  manager_id: 11,
  manager_name: 'Luis Sandoval',
  client_id: 2,
  client_name: 'Adium Co',
  status: 'active',
  co_managers: [],
} as unknown as ProjectDetailType;

describe('ProjectManagerCard', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
    mockGet.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        history: [
          {
            id: 1,
            projectId: 10,
            previousManagerId: 2,
            previousManagerName: 'Monica Robles',
            newManagerId: 11,
            newManagerName: 'Luis Sandoval',
            changedBy: 77,
            changedByName: 'Admin',
            reason: 'Traslado',
            changedAt: '2026-04-01T15:00:00.000Z',
          },
        ],
      },
    });
  });

  it(
    'S3: shows the manager, the brand note and the history without a select',
    async () => {
      renderWithQueryClient(<ProjectManagerCard project={project} />);

      expect(screen.getByText('Luis Sandoval', { selector: 'p' })).toBeInTheDocument();
      expect(
        screen.getByText(
          'Para cambiar el gerente, reasigna la marca Nulytelly a otro gerente.'
        )
      ).toBeInTheDocument();
      expect(await screen.findByText('Motivo: Traslado')).toBeInTheDocument();
      expect(screen.getByText('Registrado por Admin')).toBeInTheDocument();
      expect(mockGet).toHaveBeenCalledWith('projects/10/manager-history');

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByText(/Asignar gerente/i)).not.toBeInTheDocument();
      expect(mockPatch).not.toHaveBeenCalled();
    }
  );

  it('S8: muestra el gerente y el cliente con los que se cre\u00f3 el proyecto', async () => {
    renderWithQueryClient(
      <ProjectManagerCard
        project={{
          ...project,
          created_manager_id: 2,
          created_manager_name: 'Monica Robles',
        } as ProjectDetailType}
      />
    );

    expect(screen.getByText('Al crearse: Monica Robles (Adium Co)')).toBeInTheDocument();
    // El encabezado sigue mostrando el gerente actual
    expect(screen.getByText('Gerente principal')).toBeInTheDocument();
    expect(screen.getByText('Luis Sandoval', { selector: 'p' })).toBeInTheDocument();
    await screen.findByText('Motivo: Traslado');
  });

  it('S8: oculta la l\u00ednea si no hay gerente al crearse', async () => {
    renderWithQueryClient(
      <ProjectManagerCard
        project={{ ...project, created_manager_name: null } as unknown as ProjectDetailType}
      />
    );

    expect(screen.queryByText(/Al crearse:/)).not.toBeInTheDocument();
    await screen.findByText('Motivo: Traslado');
  });
});
