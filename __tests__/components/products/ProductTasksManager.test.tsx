import { fireEvent, screen, waitFor } from '@testing-library/react';
import { del, get } from '@/lib/services/apiService';
import ProductTasksManager from '@/components/products/ProductTasksManager';
import { apiFailure, renderWithQueryClient } from '../queryTestUtils';

jest.mock('@/lib/services/apiService', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn() }));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/components/tasks/TaskAssignmentSelector', () => ({ TaskAssignmentSelector: () => null }));

const mockGet = get as jest.Mock;
const mockDel = del as jest.Mock;
const task = {
  id: 4, product_id: 1, title: 'Brief', description: null, task_type: 'execution', requires_quote: 0,
  assign_to_commercial: 0, area_id: null, area_name: null, assigned_user_id: null, assigned_user_name: null,
  order_index: 0, quoters: [],
};

describe('ProductTasksManager', () => {
  afterEach(() => { mockGet.mockReset(); mockDel.mockReset(); });

  it('disables delete while pending, sends one request, and keeps the list with an error when the refetch fails', async () => {
    let resolveDel: (v: unknown) => void = () => {};
    mockDel.mockImplementation(() => new Promise((r) => { resolveDel = r; }));
    mockGet.mockResolvedValue(apiFailure);

    renderWithQueryClient(<ProductTasksManager productId={1} initialTasks={[task] as never} />);
    fireEvent.click(screen.getByTitle('Eliminar'));
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(mockDel).toHaveBeenCalledTimes(1));
    expect(screen.getByTitle('Eliminar')).toBeDisabled();

    resolveDel({ ok: true, status: 200, data: {} });
    expect(await screen.findByText('Error al cargar las tareas')).toBeInTheDocument();
    expect(screen.getByText('Brief')).toBeInTheDocument();
    expect(screen.queryByText(/no tiene tareas predefinidas/)).not.toBeInTheDocument();
    expect(mockDel).toHaveBeenCalledTimes(1);
  });
});
