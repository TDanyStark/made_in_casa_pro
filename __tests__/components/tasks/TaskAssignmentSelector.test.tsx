import { screen } from '@testing-library/react';
import { get } from '@/lib/services/apiService';
import { TaskAssignmentSelector } from '@/components/tasks/TaskAssignmentSelector';
import { apiFailure, renderWithQueryClient } from '../queryTestUtils';

jest.mock('@/lib/services/apiService', () => ({ get: jest.fn() }));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));

const mockGet = get as jest.Mock;
const base = {
  onAssignModeChange: jest.fn(),
  onAreaIdChange: jest.fn(),
  assignedUserId: null,
  onAssignedUserIdChange: jest.fn(),
};

describe('TaskAssignmentSelector load errors', () => {
  beforeEach(() => mockGet.mockResolvedValue(apiFailure));
  afterEach(() => mockGet.mockReset());

  it('shows an error instead of "Sin colaborador disponible" when the auto preview fails', async () => {
    renderWithQueryClient(<TaskAssignmentSelector {...base} assignMode="auto" areaId={2} />);
    expect(await screen.findByText('Error al resolver la asignación')).toBeInTheDocument();
    expect(screen.queryByText('Sin colaborador disponible')).not.toBeInTheDocument();
    expect(await screen.findByText('Error al cargar las áreas')).toBeInTheDocument();
  });

  it('shows an error instead of "no externals" when external collaborators fail', async () => {
    renderWithQueryClient(
      <TaskAssignmentSelector {...base} assignMode="auto" areaId={null} requiresQuote onQuoterIdsChange={jest.fn()} />
    );
    expect(await screen.findByText('Error al cargar los colaboradores externos')).toBeInTheDocument();
    expect(screen.queryByText('No hay colaboradores externos activos en el sistema.')).not.toBeInTheDocument();
  });

  it('shows an error when the people list fails in specific mode', async () => {
    renderWithQueryClient(<TaskAssignmentSelector {...base} assignMode="specific" areaId={null} />);
    expect(await screen.findByText('Error al cargar las personas')).toBeInTheDocument();
  });

  it('keeps "Sin colaborador disponible" when the preview succeeds with no user', async () => {
    mockGet.mockResolvedValue({ ok: true, status: 200, data: { data: null } });
    renderWithQueryClient(<TaskAssignmentSelector {...base} assignMode="auto" areaId={2} />);
    expect(await screen.findByText('Sin colaborador disponible')).toBeInTheDocument();
  });
});
