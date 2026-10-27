import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WizardStep6Confirm } from '@/components/projects/wizard/WizardStep6Confirm';
import { normalizeProjectDateTime } from '@/lib/utils/project-date-time';

const mockPush = jest.fn();
const mockPost = jest.fn();
const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockDel = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastWarning = jest.fn();

jest.mock('lucide-react', () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/dynamic', () => () => {
  const MockEditor = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Notas del proyecto" value={value} onChange={(event) => onChange(event.target.value)} />
  );

  return MockEditor;
});

jest.mock('@/lib/services/apiService', () => ({
  post: (...args: unknown[]) => mockPost(...args),
  get: (...args: unknown[]) => mockGet(...args),
  patch: (...args: unknown[]) => mockPatch(...args),
  del: (...args: unknown[]) => mockDel(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}));

const baseState = {
  title: 'Proyecto metadata',
  brand_id: 2,
  brand_name: 'Marca Uno',
  ideal_delivery_at: '2026-04-07T09:30',
  oc: '  OC-123  ',
  billing_closed_at: '2026-04-08T18:45',
  client_id: 9,
  client_name: 'Cliente Uno',
  created_by: 4,
  created_by_name: 'Ana',
  manager_id: 7,
  manager_name: 'Carlos',
  manager_email: 'carlos@test.com',
  co_manager_ids: [],
  co_manager_names: [],
  co_manager_emails: [],
  additional_brands: [],
  product: { id: 5, name: 'Producto X' } as never,
  task_overrides: [],
  extra_tasks: [],
  removed_template_ids: [],
  campaign_id: null,
  campaign_name: '',
  notes: '',
  drive_folder_id: null,
  drive_folder_url: null,
};

describe('WizardStep6Confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('empty Drive URL field: runs the automatic creation flow byte-for-byte identical to before', async () => {
    mockPost
      .mockResolvedValueOnce({ ok: true, data: { projectFolderId: 'drive-1', projectFolderUrl: 'https://drive.test/folder' } })
      .mockResolvedValueOnce({ ok: true, data: { id: 44 } })
      .mockResolvedValueOnce({ ok: true, data: {} });

    const user = userEvent.setup();

    render(<WizardStep6Confirm state={baseState} onBack={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /crear proyecto/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('projects', expect.objectContaining({
        ideal_delivery_at: normalizeProjectDateTime('2026-04-07T09:30'),
        oc: 'OC-123',
        billing_closed_at: normalizeProjectDateTime('2026-04-08T18:45'),
        drive_folder_id: 'drive-1',
        drive_folder_url: 'https://drive.test/folder',
      }));
    });

    // Managers never get Drive access: no manager emails are sent
    // (odd/tasks/brand-sourced-project-manager.md S1).
    expect(mockPost).toHaveBeenNthCalledWith(1, 'drive/create-folder', {
      clientName: 'Cliente Uno',
      brandName: 'Marca Uno',
      projectTitle: 'Proyecto metadata',
    });

    // No automatic lookup is ever performed anymore.
    expect(mockGet).not.toHaveBeenCalled();

    expect(mockPush).toHaveBeenCalledWith('/projects/44');
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it('regression: a driveWarning from create-folder (partial sharing failure) does NOT block project creation, just warns', async () => {
    // Regression guard: create-folder used to return a 500 whenever some
    // recipients failed to sync, even though the folder itself was created
    // successfully — this aborted project creation entirely. Now the API
    // returns 201 with the folder data plus a driveWarning, and the wizard
    // must continue creating the project and only show a warning toast.
    mockPost
      .mockResolvedValueOnce({
        ok: true,
        data: {
          projectFolderId: 'drive-1',
          projectFolderUrl: 'https://drive.test/folder',
          driveWarning: {
            code: 'DRIVE_ACCESS_SYNC_FAILED',
            message: 'No se pudieron sincronizar todos los accesos de Google Drive.',
          },
        },
      })
      .mockResolvedValueOnce({ ok: true, data: { id: 44 } })
      .mockResolvedValueOnce({ ok: true, data: {} });

    const user = userEvent.setup();

    render(<WizardStep6Confirm state={baseState} onBack={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /crear proyecto/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/projects/44'));

    // Folder+project creation both proceeded — no abort, no misleading error.
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockToastWarning).toHaveBeenCalledWith(
      expect.stringContaining('No se pudieron sincronizar todos los accesos de Google Drive.')
    );
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith('projects', expect.objectContaining({
      drive_folder_id: 'drive-1',
      drive_folder_url: 'https://drive.test/folder',
    }));
  });

  it('valid Drive URL provided: skips creation entirely and persists the pasted folder', async () => {
    mockPost.mockResolvedValueOnce({ ok: true, data: { id: 44 } });

    const user = userEvent.setup();
    render(<WizardStep6Confirm state={baseState} onBack={jest.fn()} />);

    const urlInput = screen.getByPlaceholderText(/drive.google.com/i);
    await user.type(urlInput, 'https://drive.google.com/drive/folders/existing-id');

    await user.click(screen.getByRole('button', { name: /crear proyecto/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('projects', expect.objectContaining({
        drive_folder_id: 'existing-id',
        drive_folder_url: 'https://drive.google.com/drive/folders/existing-id',
      }));
    });

    // drive/create-folder must NOT be called — creation skipped entirely.
    expect(mockPost).not.toHaveBeenCalledWith('drive/create-folder', expect.anything());
    expect(mockPush).toHaveBeenCalledWith('/projects/44');
  });

  it('invalid Drive URL blocks submission until fixed or cleared', async () => {
    const user = userEvent.setup();
    render(<WizardStep6Confirm state={baseState} onBack={jest.fn()} />);

    const urlInput = screen.getByPlaceholderText(/drive.google.com/i);
    const confirmButton = screen.getByRole('button', { name: /crear proyecto/i });

    await user.type(urlInput, 'https://example.com/not-a-drive-link');

    expect(await screen.findByText(/la url debe pertenecer a drive\.google\.com/i)).toBeInTheDocument();
    expect(confirmButton).toBeDisabled();
    expect(mockPost).not.toHaveBeenCalled();

    // Clearing the field un-blocks submission and runs the automatic flow.
    await user.clear(urlInput);
    await waitFor(() => expect(confirmButton).not.toBeDisabled());

    mockPost
      .mockResolvedValueOnce({ ok: true, data: { projectFolderId: 'drive-1', projectFolderUrl: 'https://drive.test/folder' } })
      .mockResolvedValueOnce({ ok: true, data: { id: 44 } });

    await user.click(confirmButton);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/projects/44'));
    expect(mockPost).toHaveBeenNthCalledWith(1, 'drive/create-folder', expect.anything());
  });
});

describe('WizardStep6Confirm — task notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const customizedState = {
    ...baseState,
    removed_template_ids: [30],
    task_overrides: [
      { template_id: 10, assigned_user_id: 8, order_index: 1 },
      { template_id: 20, order_index: 2 },
    ],
    extra_tasks: [
      {
        localId: -1,
        title: 'Extra',
        assigned_user_id: 9,
        assign_to_commercial: 0,
        area_id: null,
        task_type: 'execution' as const,
        order_index: 0,
      },
    ],
  };

  function mockApi(notifyResult: unknown = { ok: true, data: { notified: { assigned: 3, ready: 1 } } }) {
    mockPost.mockImplementation(async (url: string) => {
      if (url === 'projects') return { ok: true, data: { id: 44 } };
      if (url === 'projects/44/products') return { ok: true, data: {} };
      if (url === 'projects/44/tasks?notify=false') return { ok: true, data: { id: 501 } };
      if (url === 'projects/44/tasks/reorder?notify=false') return { ok: true, data: { success: true } };
      if (url === 'projects/44/tasks/notify-created') {
        if (notifyResult instanceof Error) throw notifyResult;
        return notifyResult;
      }
      return { ok: true, data: {} };
    });
    mockGet.mockResolvedValue({
      ok: true,
      data: [
        { id: 101, template_id: 10 },
        { id: 102, template_id: 20 },
        { id: 103, template_id: 30 },
      ],
    });
    mockPatch.mockResolvedValue({ ok: true, data: {} });
    mockDel.mockResolvedValue({ ok: true, data: {} });
  }

  async function submit() {
    const user = userEvent.setup();
    render(<WizardStep6Confirm state={customizedState} onBack={jest.fn()} />);
    // Paste an existing folder so the Drive creation step is skipped.
    await user.type(screen.getByPlaceholderText(/drive.google.com/i), 'https://drive.google.com/drive/folders/existing-id');
    await user.click(screen.getByRole('button', { name: /crear proyecto/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/projects/44'));
  }

  it('silences the intermediate task requests and calls notify-created once, last', async () => {
    mockApi();

    await submit();

    expect(mockDel).toHaveBeenCalledWith('projects/44/tasks/103?notify=false');
    expect(mockPatch).toHaveBeenCalledWith('projects/44/tasks/101?notify=false', { assigned_user_id: 8 });
    expect(mockPost).toHaveBeenCalledWith('projects/44/tasks?notify=false', expect.objectContaining({ title: 'Extra' }));
    expect(mockPost).toHaveBeenCalledWith('projects/44/tasks/reorder?notify=false', { orderedIds: [501, 101, 102] });

    const postUrls = mockPost.mock.calls.map(([url]) => url);
    expect(postUrls.filter((url) => url === 'projects/44/tasks/notify-created')).toHaveLength(1);
    expect(postUrls[postUrls.length - 1]).toBe('projects/44/tasks/notify-created');
    expect(mockPost).toHaveBeenLastCalledWith('projects/44/tasks/notify-created', {});
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(mockToastWarning).not.toHaveBeenCalled();
  });

  it('calls notify-created even without task customizations', async () => {
    mockPost.mockImplementation(async (url: string) =>
      url === 'projects' ? { ok: true, data: { id: 44 } } : { ok: true, data: {} }
    );
    const user = userEvent.setup();
    render(<WizardStep6Confirm state={baseState} onBack={jest.fn()} />);
    await user.type(screen.getByPlaceholderText(/drive.google.com/i), 'https://drive.google.com/drive/folders/existing-id');
    await user.click(screen.getByRole('button', { name: /crear proyecto/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/projects/44'));
    expect(mockPost).toHaveBeenLastCalledWith('projects/44/tasks/notify-created', {});
  });

  it('a failing notify-created only warns: the project is still created and opened', async () => {
    mockApi({ ok: false, error: 'boom' });

    await submit();

    expect(mockToastWarning).toHaveBeenCalledWith(
      'Proyecto creado, pero no se pudieron enviar los correos a los colaboradores: boom'
    );
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it('a thrown notify-created error only warns too', async () => {
    mockApi(new Error('network down'));

    await submit();

    expect(mockToastWarning).toHaveBeenCalledWith(
      'Proyecto creado, pero no se pudieron enviar los correos a los colaboradores: network down'
    );
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/projects/44');
  });

  it('does not call notify-created when project creation fails', async () => {
    mockPost.mockImplementation(async (url: string) =>
      url === 'projects' ? { ok: false, error: 'no se pudo' } : { ok: true, data: {} }
    );
    const user = userEvent.setup();
    render(<WizardStep6Confirm state={baseState} onBack={jest.fn()} />);
    await user.type(screen.getByPlaceholderText(/drive.google.com/i), 'https://drive.google.com/drive/folders/existing-id');
    await user.click(screen.getByRole('button', { name: /crear proyecto/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('no se pudo'));
    expect(mockPost).not.toHaveBeenCalledWith('projects/44/tasks/notify-created', expect.anything());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('S7: sends the associated brands as additional_brand_ids', async () => {
    mockPost
      .mockResolvedValueOnce({ ok: true, data: { projectFolderId: 'drive-1', projectFolderUrl: 'https://drive.test/folder' } })
      .mockResolvedValueOnce({ ok: true, data: { id: 44 } })
      .mockResolvedValueOnce({ ok: true, data: {} });
    const user = userEvent.setup();

    render(<WizardStep6Confirm state={{ ...baseState, additional_brands: [{ id: 5, name: 'B' }, { id: 6, name: 'C' }] }} onBack={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: /crear proyecto/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('projects', expect.objectContaining({ brand_id: 2, additional_brand_ids: [5, 6] }));
    });
    // Drive keeps using the principal brand (S4)
    expect(mockPost).toHaveBeenNthCalledWith(1, 'drive/create-folder', expect.objectContaining({ brandName: 'Marca Uno' }));
  });
});
