import { fireEvent, screen, waitFor } from '@testing-library/react';
import { get } from '@/lib/services/apiService';
import SiigoCustomersList from '@/components/siigo/SiigoCustomersList';
import { renderWithQueryClient } from '../queryTestUtils';

jest.mock('@/lib/services/apiService', () => ({ get: jest.fn() }));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));

const mockGet = get as jest.Mock;
const fetchSpy = jest.fn();

const customer = (id: string, name: string) => ({
  id, name: [name], identification: '900', id_type: { name: 'NIT' }, active: true, contacts: [],
});
const page = (results: unknown[]) => ({
  ok: true, status: 200,
  data: { results, pagination: { total_results: results.length, page_size: 10 } },
});

describe('SiigoCustomersList', () => {
  beforeEach(() => {
    mockGet.mockReset();
    fetchSpy.mockReset();
    global.fetch = fetchSpy as unknown as typeof fetch;
    mockGet.mockImplementation(async (url: string) =>
      url.includes('term=') ? page([customer('2', 'Acme SAS')]) : page([customer('1', 'Todos SAS')])
    );
  });

  it('loads the first page through apiService', async () => {
    renderWithQueryClient(<SiigoCustomersList />);
    expect(await screen.findByText('Todos SAS')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('siigo/customers?page=1&pageSize=10');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not request per keystroke and requests once on submit', async () => {
    renderWithQueryClient(<SiigoCustomersList />);
    await screen.findByText('Todos SAS');
    const input = screen.getByPlaceholderText('Buscar por nombre o identificación...');
    for (const value of ['A', 'Ac', 'Acm', 'Acme']) fireEvent.change(input, { target: { value } });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockGet).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect(await screen.findByText('Acme SAS')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet).toHaveBeenLastCalledWith('siigo/customers?page=1&pageSize=10&term=Acme');
  });

  it('shows an error instead of "No se encontraron clientes" when the API fails', async () => {
    mockGet.mockResolvedValue({ ok: false, status: 500, error: 'Error al obtener clientes de Siigo' });
    renderWithQueryClient(<SiigoCustomersList />);
    expect(await screen.findByText('Error al cargar los clientes de Siigo')).toBeInTheDocument();
    expect(screen.queryByText('No se encontraron clientes')).not.toBeInTheDocument();
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
  });
});
