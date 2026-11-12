import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { get } from '@/lib/services/apiService';
import { TaskWorkSheet } from '@/components/tasks/TaskWorkSheet';
import type { MyTaskRowPaginated, TaskWorkContext } from '@/lib/definitions';

jest.mock('@/lib/services/apiService', () => ({ get: jest.fn() }));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));
const mockGet = get as jest.Mock;

const task: MyTaskRowPaginated = {
  id: 42,
  title: 'Diseñar piezas para redes',
  description: 'Crear 3 piezas para Instagram',
  project_id: 7,
  area_id: 1,
  area_name: 'Diseño',
  assigned_user_id: 3,
  assigned_user_name: 'Ana',
  assigned_user_rol_id: 4,
  status: 'in_progress',
  task_type: 'execution',
  task_flag: 'new',
  adjustment_id: null,
  version_number: 1,
  requires_quote: 0,
  assign_to_commercial: 0,
  order_index: 2,
  assigned_at: '2026-03-10T15:30:00',
  completed_at: null,
  created_at: '2026-03-01T10:00:00',
  updated_at: '2026-03-10T15:30:00',
  delivery_url: null,
  completion_cost: null,
  progress_percent: 40,
  progress_minutes: 90,
  project_title: 'Campaña Verano',
  product_name: 'Social media',
  brand_id: 1,
  brand_name: 'Marca X',
  creator_user_id: 9,
  creator_user_name: 'Carlos',
};

const baseContext: TaskWorkContext = {
  task_id: 42,
  project_id: 7,
  drive_folder_url: 'https://drive.google.com/drive/folders/abc',
  project_notes: '<p>Usar la <strong>paleta oficial</strong></p>',
  version_notes: null,
  version_number: 1,
  previous_tasks: [
    {
      id: 41,
      title: 'Brief creativo',
      task_type: 'execution',
      status: 'completed',
      version_number: 1,
      assigned_user_name: 'Luis',
      completed_at: '2026-03-09T12:00:00',
      delivery_url: 'https://drive.google.com/file/d/brief',
      delivery_notes: '<p>Brief aprobado por el cliente</p>',
    },
  ],
};

function renderSheet(
  context: TaskWorkContext = baseContext,
  actions?: React.ReactNode,
  taskOverrides: Partial<MyTaskRowPaginated> = {}
) {
  mockGet.mockResolvedValue({ ok: true, status: 200, data: context });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TaskWorkSheet
        task={{ ...task, ...taskOverrides }}
        open
        onOpenChange={() => {}}
        actions={actions}
      />
    </QueryClientProvider>
  );
}

describe('TaskWorkSheet', () => {
  afterEach(() => mockGet.mockReset());

  it('requests the task work context when open', async () => {
    renderSheet();
    expect(await screen.findByText('paleta oficial')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('projects/7/tasks/42/context');
  });

  it('shows the task title, description, assignment date and status', async () => {
    renderSheet();
    expect(screen.getByRole('heading', { name: 'Diseñar piezas para redes' })).toBeInTheDocument();
    expect(screen.getByText('Crear 3 piezas para Instagram')).toBeInTheDocument();
    expect(screen.getByText(/^Asignada el 10 mar 2026, 15:30/)).toBeInTheDocument();
    expect(screen.getByText('En progreso')).toBeInTheDocument();
    await screen.findByText('paleta oficial');
  });

  it('links to the Drive folder and the project in a new tab', async () => {
    renderSheet();
    const drive = (await screen.findByText('Drive')).closest('a');
    expect(drive).toHaveAttribute('href', 'https://drive.google.com/drive/folders/abc');
    expect(drive).toHaveAttribute('target', '_blank');

    const project = screen.getByText('Proyecto').closest('a');
    expect(project).toHaveAttribute('href', '/projects/7');
    expect(project).toHaveAttribute('target', '_blank');
  });

  it('does not link a Drive folder or deliverable that is not an http(s) URL', async () => {
    const user = userEvent.setup();
    renderSheet({
      ...baseContext,
      drive_folder_url: 'ftp://files.example.com/folder',
      previous_tasks: [
        { ...baseContext.previous_tasks[0], delivery_url: 'ftp://files.example.com/brief' },
      ],
    });
    expect(await screen.findByText('Sin carpeta de Drive')).toBeInTheDocument();
    expect(screen.queryByText('Drive')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ver notas y entregable de/ }));
    expect(screen.getByText('Brief aprobado por el cliente')).toBeInTheDocument();
    expect(screen.queryByText('Abrir entregable')).not.toBeInTheDocument();
  });

  it('does not link the own deliverable when it is not an http(s) URL', async () => {
    renderSheet(baseContext, undefined, { delivery_url: 'javascript:alert(1)' });
    await screen.findByText('paleta oficial');
    expect(screen.queryByText('Mi entregable')).not.toBeInTheDocument();
  });

  it('links the own deliverable when it is an http(s) URL', async () => {
    renderSheet(baseContext, undefined, { delivery_url: 'https://drive.google.com/file/d/mine' });
    const link = (await screen.findByText('Mi entregable')).closest('a');
    expect(link).toHaveAttribute('href', 'https://drive.google.com/file/d/mine');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders the project notes as HTML', async () => {
    renderSheet();
    const strong = await screen.findByText('paleta oficial');
    expect(strong.tagName).toBe('STRONG');
  });

  it('shows an empty message when the project has no notes', async () => {
    renderSheet({ ...baseContext, project_notes: null });
    expect(await screen.findByText('Este proyecto no tiene notas.')).toBeInTheDocument();
  });

  it('reveals notes and deliverable of a previous task with the eye button', async () => {
    const user = userEvent.setup();
    renderSheet();
    const eye = await screen.findByRole('button', {
      name: 'Ver notas y entregable de Brief creativo',
    });
    expect(screen.getByText('Brief creativo')).toBeInTheDocument();
    expect(eye).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Brief aprobado por el cliente')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Abrir entregable/ })).not.toBeInTheDocument();

    await user.click(eye);

    expect(eye).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Brief aprobado por el cliente')).toBeInTheDocument();
    const deliverable = screen.getByRole('link', { name: /Abrir entregable/ });
    expect(deliverable).toHaveAttribute('href', 'https://drive.google.com/file/d/brief');
    expect(deliverable).toHaveAttribute('target', '_blank');
  });

  it('shows an empty message when no previous task is completed', async () => {
    renderSheet({ ...baseContext, previous_tasks: [] });
    expect(
      await screen.findByText('Aún no hay tareas completadas en este proyecto.')
    ).toBeInTheDocument();
  });

  it('renders the actions passed by the parent', async () => {
    renderSheet(baseContext, <button type="button">Tomar tarea</button>);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Tomar tarea' })).toBeInTheDocument();
    await screen.findByText('paleta oficial');
  });
});
