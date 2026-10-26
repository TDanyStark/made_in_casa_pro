import { fireEvent, screen, waitFor } from '@testing-library/react';
import { del, get } from '@/lib/services/apiService';
import { ProjectQuotesTab } from '@/components/projects/ProjectQuotesTab';
import { apiFailure, renderWithQueryClient } from '../queryTestUtils';

jest.mock('@/lib/services/apiService', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn() }));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockGet = get as jest.Mock;
const mockDel = del as jest.Mock;

const task = {
  id: 3, title: 'Diseño', requires_quote: 1, status: 'blocked', pending_quote_count: 0,
  created_at: '2026-01-01', area_name: null, area_id: null,
};

describe('ProjectQuotesTab', () => {
  afterEach(() => { mockGet.mockReset(); mockDel.mockReset(); });

  it('shows an error state instead of "Sin cotizaciones pendientes" when tasks fail to load', async () => {
    mockGet.mockResolvedValue(apiFailure);
    renderWithQueryClient(<ProjectQuotesTab projectId={1} canEdit />);
    expect(await screen.findByText('Error al cargar las cotizaciones')).toBeInTheDocument();
    expect(screen.queryByText('Sin cotizaciones pendientes')).not.toBeInTheDocument();
  });

  it('shows an error state in the task card when its quotes fail to load', async () => {
    mockGet.mockImplementation(async (url: string) =>
      url.endsWith('/quotes') ? apiFailure : { ok: true, status: 200, data: [task] }
    );
    renderWithQueryClient(<ProjectQuotesTab projectId={1} canEdit />);
    expect(await screen.findByText('Error al cargar las cotizaciones')).toBeInTheDocument();
    expect(screen.queryByText(/Aún no hay invitaciones/)).not.toBeInTheDocument();
  });

  it('sanitizes quote notes and blocks a second removal while one is pending', async () => {
    mockGet.mockImplementation(async (url: string) =>
      url.endsWith('/quotes')
        ? {
            ok: true, status: 200,
            data: {
              invitations: [
                { id: 1, user_id: 7, user_name: 'Ext Uno', quote_status: null },
                { id: 2, user_id: 8, user_name: 'Ext Dos', quote_status: 'pending' },
              ],
              quotes: [{ id: 9, user_id: 8, user_name: 'Ext Dos', status: 'pending', price: 10, delivery_minutes: 60,
                notes: '<p><strong>nota</strong></p><img src=x onerror="alert(1)">' }],
            },
          }
        : { ok: true, status: 200, data: [task] }
    );
    let resolveDel: (v: unknown) => void = () => {};
    mockDel.mockImplementation(() => new Promise((r) => { resolveDel = r; }));

    const { container } = renderWithQueryClient(<ProjectQuotesTab projectId={1} canEdit />);
    expect((await screen.findByText('nota')).tagName).toBe('STRONG');
    expect(container.querySelector('img')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar invitación de Ext Uno' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(mockDel).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Quitar invitación de Ext Uno' })).toBeDisabled();

    resolveDel({ ok: true, status: 200, data: {} });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Quitar invitación de Ext Uno' })).not.toBeDisabled()
    );
    expect(mockDel).toHaveBeenCalledTimes(1);
  });
});
