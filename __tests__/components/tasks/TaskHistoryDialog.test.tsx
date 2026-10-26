import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { get } from '@/lib/services/apiService';
import { TaskHistoryDialog } from '@/components/tasks/TaskHistoryDialog';

jest.mock('@/lib/services/apiService', () => ({ get: jest.fn() }));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));
const mockGet = get as jest.Mock;

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TaskHistoryDialog open onOpenChange={() => {}} taskId={5} taskTitle="Tarea" />
    </QueryClientProvider>
  );
}

describe('TaskHistoryDialog', () => {
  afterEach(() => mockGet.mockReset());

  it('shows an error state instead of the empty state when the API fails', async () => {
    mockGet.mockResolvedValue({ ok: false, status: 401, error: 'No autorizado' });
    renderDialog();
    expect(await screen.findByText('Error al cargar el historial')).toBeInTheDocument();
    expect(screen.queryByText('No hay historial registrado para esta tarea.')).not.toBeInTheDocument();
  });

  it('keeps the empty state for a successful empty response', async () => {
    mockGet.mockResolvedValue({ ok: true, status: 200, data: [] });
    renderDialog();
    expect(await screen.findByText('No hay historial registrado para esta tarea.')).toBeInTheDocument();
  });

  it('renders transition notes sanitized', async () => {
    mockGet.mockResolvedValue({
      ok: true,
      status: 200,
      data: [{
        id: 1, to_status: 'completed', transitioned_at: '2026-01-01T10:00:00Z', moved_by_name: 'Ana',
        notes: '<p><strong>listo</strong></p><img src=x onerror="alert(1)">',
      }],
    });
    renderDialog();
    const strong = await screen.findByText('listo');
    expect(strong.tagName).toBe('STRONG');
    expect(document.querySelector('img')).toBeNull();
  });
});
