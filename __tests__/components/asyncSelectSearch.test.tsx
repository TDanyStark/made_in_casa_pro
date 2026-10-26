// S29: clearing the select text removes the search filter, and keystrokes are
// debounced into one request even though the component re-renders in between.
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Form } from '@/components/ui/form';
import { ClientSelect } from '@/components/clients/ClientSelect';
import { ManagerSelect } from '@/components/managers/ManagerSelect';
import { BrandSelect } from '@/components/brands/BrandSelect';
import { BusinessUnitBrandSelect } from '@/components/brands/BusinessUnitBrandSelect';
import { ChangeManager } from '@/components/brands/ChangeManager';
import AreaSelect from '@/components/users/AreaSelect';
import SkillSelect from '@/components/users/SkillSelect';

jest.mock('@/lib/services/apiService', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn() }));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock('@/hooks/useClientsDirectory', () => ({ useClientsDirectory: () => ({ clientNames: {}, isLoading: false }) }));
jest.mock('@/components/clients/CreateClientModal', () => () => null);
jest.mock('@/components/managers/CreateManagerModal', () => () => null);
jest.mock('@/components/clients/CreateBrandModal', () => () => null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockSelectProps: any;
jest.mock('react-select/creatable', () => ({
  __esModule: true,
  default: (props: unknown) => { mockSelectProps = props; return null; },
}));

import { get } from '@/lib/services/apiService';
const mockGet = get as jest.Mock;

function FormHarness({ render: renderField }: { render: (form: ReturnType<typeof useForm>) => React.ReactNode }) {
  const form = useForm();
  return <Form {...form}>{renderField(form)}</Form>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const cases: Array<[string, string, () => React.ReactElement]> = [
  ['ClientSelect', 'clients', () => <FormHarness render={(f) => <ClientSelect control={f.control} name="client_id" />} />],
  ['ManagerSelect', 'managers', () => <FormHarness render={(f) => <ManagerSelect form={f as any} control={f.control} name="manager_id" />} />],
  ['BrandSelect', 'brands', () => <FormHarness render={(f) => <BrandSelect form={f as any} control={f.control as any} name="brand_id" />} />],
  ['BusinessUnitBrandSelect', 'business-units', () => <BusinessUnitBrandSelect standalone brandId={3} />],
  ['ChangeManager', 'managers', () => <ChangeManager brandId={3} managerId={1} clientId={2} />],
  ['AreaSelect', 'areas', () => <AreaSelect user_id={1} />],
  ['SkillSelect', 'skills', () => <SkillSelect user_id={1} />],
];
/* eslint-enable @typescript-eslint/no-explicit-any */

const searchCalls = (term: string) =>
  mockGet.mock.calls.filter(([url]: [string]) => url.includes(`search=${term}`)).length;

describe.each(cases)('%s search', (_name, _endpoint, ui) => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockImplementation(async (url: string) => {
      const filtered = /search=[^&]/.test(url);
      const name = filtered ? 'Filtrado' : 'Todos';
      const row = { id: filtered ? 2 : 1, name, brand_name: name };
      return { ok: true, status: 200, data: { data: [row], pageCount: 1, currentPage: 1, total: 1 } };
    });
    mockSelectProps = undefined;
  });

  function renderSelect() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = () => <QueryClientProvider client={client}>{ui()}</QueryClientProvider>;
    const result = render(tree());
    return { ...result, rerenderSame: () => result.rerender(tree()) };
  }

  it('debounces keystrokes across re-renders into a single search', async () => {
    const { rerenderSame } = renderSelect();
    await waitFor(() => expect(mockSelectProps).toBeDefined());
    act(() => mockSelectProps.onInputChange('a', { action: 'input-change' }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    rerenderSame();
    act(() => mockSelectProps.onInputChange('ab', { action: 'input-change' }));
    await waitFor(() => expect(searchCalls('ab')).toBe(1), { timeout: 2000 });
    expect(mockGet.mock.calls.some(([url]: [string]) => /search=a($|&)/.test(url))).toBe(false);
  });

  it('clearing the text removes the search filter', async () => {
    renderSelect();
    await waitFor(() => expect(mockSelectProps).toBeDefined());
    act(() => mockSelectProps.onInputChange('acme', { action: 'input-change' }));
    await waitFor(() => expect(searchCalls('acme')).toBe(1), { timeout: 2000 });

    const labels = () => mockSelectProps.options.map((o: { label: string }) => o.label);
    await waitFor(() => expect(labels()).toContain('Filtrado'));

    act(() => mockSelectProps.onInputChange('', { action: 'input-change' }));
    await waitFor(() => expect(labels()).toContain('Todos'));
    expect(labels()).not.toContain('Filtrado');
  });
});
