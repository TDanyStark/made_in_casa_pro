// Spec: odd/tasks/brand-owned-project-manager.md — S3, S8
// Spec: odd/tasks/brand-sourced-project-manager.md — S3
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
  current_client_id: 3,
  current_client_name: 'Abbott Co',
  client_id: 2,
  client_name: 'Adium Co',
  status: 'active',
  co_managers: [],
} as unknown as ProjectDetailType;

describe('ProjectManagerCard', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
  });

  it(
    'S3 (brand-sourced-project-manager): muestra el gerente y cliente actuales sin historial ni peticiones',
    () => {
      renderWithQueryClient(<ProjectManagerCard project={project} />);

      expect(screen.getByText('Gerente principal')).toBeInTheDocument();
      expect(screen.getByText('Luis Sandoval (Abbott Co)')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Para cambiar el gerente, reasigna la marca Nulytelly a otro gerente.'
        )
      ).toBeInTheDocument();
      expect(screen.queryByText('Historial de gerentes')).not.toBeInTheDocument();
      expect(mockGet).not.toHaveBeenCalled();

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(mockPatch).not.toHaveBeenCalled();
    }
  );

  it('S3: muestra el gerente y el cliente con los que se cre\u00f3 el proyecto', () => {
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
    expect(screen.getByText('Luis Sandoval (Abbott Co)')).toBeInTheDocument();
  });

  it('oculta la l\u00ednea si no hay gerente al crearse', () => {
    renderWithQueryClient(
      <ProjectManagerCard
        project={{ ...project, created_manager_name: null } as unknown as ProjectDetailType}
      />
    );

    expect(screen.queryByText(/Al crearse:/)).not.toBeInTheDocument();
  });
});
