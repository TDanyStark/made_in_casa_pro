import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { get } from '@/lib/services/apiService';
import { MyQuotesClient } from '@/components/quotes/MyQuotesClient';

jest.mock('@/lib/services/apiService', () => ({ get: jest.fn() }));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/quotes/SubmitQuoteModal', () => ({ SubmitQuoteModal: () => null }));
jest.mock('@/components/ui/tabs', () => {
  const Pass = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { Tabs: Pass, TabsList: Pass, TabsTrigger: Pass, TabsContent: Pass };
});
const mockGet = get as jest.Mock;

describe('MyQuotesClient', () => {
  it('renders quote notes sanitized', async () => {
    mockGet.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        invitations: [],
        quotes: [{
          id: 1, task_title: 'Logo', status: 'pending', created_at: '2026-01-01', price: 1000,
          delivery_minutes: 60, notes: '<p><em>propuesta</em></p><img src=x onerror="alert(1)"><script>alert(2)</script>',
        }],
      },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}><MyQuotesClient /></QueryClientProvider>
    );
    const em = await screen.findByText('propuesta');
    expect(em.tagName).toBe('EM');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  // S40: dates use the es-CO format (Bogotá time) like the rest of the app.
  it('formats invitation and quote dates in es-CO', async () => {
    mockGet.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        invitations: [{
          id: 2, task_id: 9, project_id: 4, task_title: 'Banner', project_name: 'Proyecto',
          invited_at: '2026-03-05T15:00:00Z', invited_by_name: null,
        }],
        quotes: [{
          id: 1, task_title: 'Logo', status: 'pending', created_at: '2026-01-15T15:00:00Z', price: 1500000,
          delivery_minutes: 60, notes: null,
        }],
      },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MyQuotesClient /></QueryClientProvider>);

    expect(await screen.findByText(/Invitado el: 5 de marzo de 2026/)).toBeInTheDocument();
    expect(screen.getByText('Propuesta enviada el 15 de enero de 2026')).toBeInTheDocument();
    expect(screen.getByText(/Precio: \$1\.500\.000/)).toBeInTheDocument();
  });
});
