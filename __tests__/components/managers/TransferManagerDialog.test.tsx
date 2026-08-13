import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransferManagerDialog } from '@/components/managers/TransferManagerDialog';
import { ManagerTransferPreview } from '@/lib/definitions';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('lucide-react', () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

jest.mock('@/lib/services/apiService', () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// El diálogo lee el preview con useQuery; el resto de la app inyecta el
// QueryClient en el layout, así que aquí lo simulamos con el preview estático.
let previewState: {
  data: ManagerTransferPreview | undefined;
  isLoading: boolean;
  isError: boolean;
} = { data: undefined, isLoading: true, isError: false };

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => previewState,
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  }),
}));

// ClientSelect / ManagerSelect hacen sus propias peticiones y montan
// CreatableSelect (no interactuable en jsdom): los sustituimos por selects
// nativos que escriben en el mismo campo del formulario.
jest.mock('@/components/clients/ClientSelect', () => ({
  ClientSelect: ({
    control,
    name,
    label,
    excludeClientId,
  }: {
    control: { _formValues: Record<string, unknown> };
    name: string;
    label?: string;
    excludeClientId?: number;
  }) => {
    const { useFormContext } = jest.requireActual('react-hook-form');
    return (
      <MockNumberSelect
        useFormContext={useFormContext}
        name={name}
        label={label ?? 'Cliente'}
        options={[
          { value: 1, label: 'Abbott Co' },
          { value: 2, label: 'Adium Co' },
        ].filter((o) => o.value !== excludeClientId)}
        testId="client-select"
      />
    );
  },
}));

jest.mock('@/components/managers/ManagerSelect', () => ({
  ManagerSelect: ({ name, label }: { name: string; label?: string }) => {
    const { useFormContext } = jest.requireActual('react-hook-form');
    return (
      <MockNumberSelect
        useFormContext={useFormContext}
        name={name}
        label={label ?? 'Gerente'}
        options={[
          { value: 11, label: 'Luis Sandoval' },
          { value: 12, label: 'Ana Pérez' },
        ]}
        testId={`manager-select-${name}`}
      />
    );
  },
}));

function MockNumberSelect({
  useFormContext,
  name,
  label,
  options,
  testId,
}: {
  useFormContext: () => {
    setValue: (name: string, value: unknown) => void;
  };
  name: string;
  label: string;
  options: Array<{ value: number; label: string }>;
  testId: string;
}) {
  const { setValue } = useFormContext();
  return (
    <div>
      <label htmlFor={testId}>{label}</label>
      <select
        id={testId}
        data-testid={testId}
        onChange={(event) =>
          setValue(name, event.target.value ? Number(event.target.value) : undefined)
        }
        defaultValue=""
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const preview: ManagerTransferPreview = {
  manager: {
    id: 2,
    client_id: 2,
    name: 'Monica Robles',
    email: 'monica@adium.com',
    phone: '+58 111',
  },
  current_client: { id: 2, name: 'Adium Co' } as ManagerTransferPreview['current_client'],
  brands: [
    { id: 5, name: 'Nulytelly' },
    { id: 6, name: 'Gastrum' },
  ],
  projects: [
    {
      id: 11,
      title: 'Nulytelly 2026',
      status: 'active',
      brand_id: 5,
      brand_name: 'Nulytelly',
    },
  ],
  available_managers: [
    { id: 11, name: 'Luis Sandoval', email: 'luis@adium.com' },
  ],
};

function renderDialog() {
  return render(
    <TransferManagerDialog managerId={2} open onOpenChange={jest.fn()} />
  );
}

describe('TransferManagerDialog', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockInvalidateQueries.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
    previewState = { data: preview, isLoading: false, isError: false };
  });

  it('renders the preview: current email, brands and active projects', () => {
    renderDialog();

    expect(
      screen.getByText(/Actual: monica@adium.com/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Marcas en Adium Co')).toBeInTheDocument();
    expect(screen.getByText('Nulytelly')).toBeInTheDocument();
    expect(screen.getByText('Gastrum')).toBeInTheDocument();
    expect(screen.getByText('Proyectos activos')).toBeInTheDocument();
    expect(screen.getByText('Nulytelly 2026')).toBeInTheDocument();

    // Nada tiene sucesor todavía: todo se trasladaría con el gerente.
    expect(
      screen.getByText(/2 marca\(s\) y 1 proyecto\(s\) sin sucesor/i)
    ).toBeInTheDocument();
  });

  it('shows the skeleton while the preview loads', () => {
    previewState = { data: undefined, isLoading: true, isError: false };
    renderDialog();

    expect(screen.getByTestId('transfer-preview-loading')).toBeInTheDocument();
    expect(screen.queryByText('Proyectos activos')).not.toBeInTheDocument();
  });

  it('submits the transfer with brand and project reassignments', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        manager: preview.manager,
        previous_client_id: 2,
        new_client_id: 1,
        reassigned_brands: 1,
        reassigned_projects: 1,
      },
    });

    renderDialog();

    await user.selectOptions(screen.getByTestId('client-select'), '1');
    await user.selectOptions(
      screen.getByTestId('manager-select-brand_reassignments.5'),
      '11'
    );
    await user.selectOptions(
      screen.getByTestId('manager-select-project_reassignments.11'),
      '11'
    );
    await user.type(
      screen.getByLabelText(/correo corporativo nuevo/i),
      'monica@abbott.com'
    );
    await user.type(screen.getByLabelText(/motivo/i), 'Cambio de laboratorio');

    await user.click(screen.getByRole('button', { name: /trasladar gerente/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('managers/2/transfer', {
        target_client_id: 1,
        email: 'monica@abbott.com',
        reason: 'Cambio de laboratorio',
        brand_reassignments: [{ brand_id: 5, new_manager_id: 11 }],
        project_reassignments: [{ project_id: 11, new_manager_id: 11 }],
      });
    });

    expect(mockToastSuccess).toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['manager-history', 2],
    });
  });

  it('surfaces a specific message when the email is already taken (409)', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({
      ok: false,
      status: 409,
      error: 'El correo electrónico ya está en uso por otro gerente',
      data: {
        error: 'El correo electrónico ya está en uso por otro gerente',
        code: 'EMAIL_IN_USE',
      },
    });

    renderDialog();

    await user.selectOptions(screen.getByTestId('client-select'), '1');
    await user.type(
      screen.getByLabelText(/correo corporativo nuevo/i),
      'ocupado@abbott.com'
    );
    await user.click(screen.getByRole('button', { name: /trasladar gerente/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining('Ese correo ya lo usa otro gerente')
      );
    });
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('requires a target client before submitting', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /trasladar gerente/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Selecciona el cliente destino'
      );
    });
    expect(mockPost).not.toHaveBeenCalled();
  });
});
