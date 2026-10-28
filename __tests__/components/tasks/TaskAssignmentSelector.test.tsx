import { screen } from '@testing-library/react';
import { get } from '@/lib/services/apiService';
import { TaskAssignmentSelector, getAssignmentErrors } from '@/components/tasks/TaskAssignmentSelector';
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

describe('TaskAssignmentSelector assignment options', () => {
  beforeEach(() => mockGet.mockResolvedValue({ ok: true, status: 200, data: { data: [] } }));
  afterEach(() => mockGet.mockReset());

  it('lists "Persona específica" first and "Auto-asignación por área" third', () => {
    renderWithQueryClient(<TaskAssignmentSelector {...base} assignMode="specific" areaId={null} />);
    const labels = ['Persona específica', 'Comercial encargado', 'Auto-asignación por área'];
    const buttons = labels.map((l) => screen.getByText(l).closest('button')!);
    const all = screen.getAllByRole('button');
    expect(buttons.map((b) => all.indexOf(b))).toEqual([0, 1, 2]);
  });

  it('does not offer "Sin área específica" in auto mode', () => {
    renderWithQueryClient(<TaskAssignmentSelector {...base} assignMode="auto" areaId={null} />);
    expect(screen.queryByText('Sin área específica')).not.toBeInTheDocument();
    expect(screen.getByText('Seleccionar área')).toBeInTheDocument();
  });
});

describe('getAssignmentErrors', () => {
  it('requires a person in specific mode', () => {
    expect(getAssignmentErrors({ assignMode: 'specific', areaId: null, assignedUserId: null })).toEqual([
      { field: 'assigned_user_id', message: "Debes seleccionar una persona cuando el modo es 'Persona específica'" },
    ]);
    expect(getAssignmentErrors({ assignMode: 'specific', areaId: null, assignedUserId: 4 })).toEqual([]);
  });

  it('requires an area in auto mode unless the task requires a quote', () => {
    expect(getAssignmentErrors({ assignMode: 'auto', areaId: null, assignedUserId: null })).toEqual([
      { field: 'area_id', message: 'Selecciona un área para la auto-asignación, o cambia a otro modo' },
    ]);
    expect(getAssignmentErrors({ assignMode: 'auto', areaId: 2, assignedUserId: null })).toEqual([]);
    expect(getAssignmentErrors({ assignMode: 'auto', areaId: null, assignedUserId: null, requiresQuote: true })).toEqual([]);
  });

  it('accepts commercial mode without person or area', () => {
    expect(getAssignmentErrors({ assignMode: 'commercial', areaId: null, assignedUserId: null })).toEqual([]);
  });
});
