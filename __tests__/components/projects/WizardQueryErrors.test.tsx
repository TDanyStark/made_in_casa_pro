import { screen, waitFor } from '@testing-library/react';
import { get } from '@/lib/services/apiService';
import { WizardStep1Basics } from '@/components/projects/wizard/WizardStep1Basics';
import { WizardStep2Manager } from '@/components/projects/wizard/WizardStep2Manager';
import { WizardStep3Products } from '@/components/projects/wizard/WizardStep3Products';
import { ProjectCoManagersTab } from '@/components/projects/ProjectCoManagersTab';
import { apiFailure, renderWithQueryClient } from '../queryTestUtils';

jest.mock('@/lib/services/apiService', () => ({ get: jest.fn(), post: jest.fn(), del: jest.fn() }));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/brands/BrandSelect', () => ({ BrandSelect: () => null }));
jest.mock('@/components/products/CreateProductModal', () => () => null);

type SelectProps = { instanceId?: string; noOptionsMessage?: (o: { inputValue: string }) => string; isLoading?: boolean };
const mockSelects: Record<string, SelectProps> = {};
jest.mock('react-select', () => ({
  __esModule: true,
  default: (props: SelectProps) => { mockSelects[props.instanceId ?? 'default'] = props; return null; },
}));
jest.mock('react-select/creatable', () => ({
  __esModule: true,
  default: (props: SelectProps) => { mockSelects.creatable = props; return null; },
}));

const mockGet = get as jest.Mock;

describe('project wizard query errors', () => {
  beforeEach(() => mockGet.mockResolvedValue(apiFailure));
  afterEach(() => mockGet.mockReset());

  it('WizardStep1Basics shows an error when the brand detail fails and keeps Siguiente disabled', async () => {
    renderWithQueryClient(
      <WizardStep1Basics
        state={{ title: 'P', brand_id: 4, brand_name: 'Marca', ideal_delivery_at: '', oc: '', billing_closed_at: null } as never}
        onNext={jest.fn()}
      />
    );
    expect(await screen.findByText('Error al cargar la información de la marca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('WizardStep2Manager reports a load error in the co-manager select', async () => {
    renderWithQueryClient(
      <WizardStep2Manager
        state={{ client_id: 2, manager_id: 1, co_manager_ids: [], co_manager_names: [], co_manager_emails: [] } as never}
        onNext={jest.fn()}
        onBack={jest.fn()}
      />
    );
    await waitFor(() =>
      expect(mockSelects['wizard-comanager-select'].noOptionsMessage!({ inputValue: '' })).toBe('Error al cargar los gerentes')
    );
  });

  it('WizardStep3Products reports a load error in the product select', async () => {
    renderWithQueryClient(<WizardStep3Products state={{ product: null } as never} onNext={jest.fn()} onBack={jest.fn()} />);
    await waitFor(() =>
      expect(mockSelects.creatable.noOptionsMessage!({ inputValue: 'x' })).toBe('Error al cargar los productos')
    );
  });

  it('ProjectCoManagersTab reports a load error in the manager select', async () => {
    renderWithQueryClient(
      <ProjectCoManagersTab projectId={1} clientId={2} mainManagerId={1} coManagers={[]} canEdit />
    );
    await waitFor(() =>
      expect(mockSelects['project-comanagers-select'].noOptionsMessage!({ inputValue: '' })).toBe('Error al cargar los gerentes')
    );
  });
});
