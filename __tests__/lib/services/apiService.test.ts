import { fetchApi, get, post, put, patch, del } from '@/lib/services/apiService';

// Helper to create a mock fetch response
function mockFetchResponse(data: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('fetchApi()', () => {
  it('prepends /api/ when endpoint does not start with /api/', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(
      mockFetchResponse({ items: [] })
    );
    await fetchApi('clients', { method: 'GET' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/clients',
      expect.any(Object)
    );
  });

  it('does NOT double-prepend /api/ when endpoint already starts with /api/', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(
      mockFetchResponse({ items: [] })
    );
    await fetchApi('/api/clients', { method: 'GET' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/clients',
      expect.any(Object)
    );
  });

  it('sets Content-Type: application/json header by default', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(mockFetchResponse({}));
    await fetchApi('test', { method: 'GET' });
    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(callArgs.headers['Content-Type']).toBe('application/json');
  });

  it('merges caller-provided headers with defaults', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(mockFetchResponse({}));
    await fetchApi('test', { method: 'GET', headers: { Authorization: 'Bearer token' } });
    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(callArgs.headers['Content-Type']).toBe('application/json');
    expect(callArgs.headers['Authorization']).toBe('Bearer token');
  });

  it('serializes body to JSON for POST requests', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(mockFetchResponse({}));
    await fetchApi('test', { method: 'POST', body: { name: 'test' } });
    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(callArgs.body).toBe(JSON.stringify({ name: 'test' }));
  });

  it('sends no body for GET requests', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(mockFetchResponse({}));
    await fetchApi('test', { method: 'GET' });
    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(callArgs.body).toBeUndefined();
  });

  it('returns { ok: true, status: 200, data: responseBody } on success', async () => {
    const mockData = { id: 1, name: 'Test Client' };
    (global.fetch as jest.Mock).mockReturnValueOnce(mockFetchResponse(mockData));
    const result = await fetchApi('clients', { method: 'GET' });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual(mockData);
    expect(result.error).toBeUndefined();
  });

  it('returns { ok: false, error: serverErrorMessage } on non-ok response', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(
      mockFetchResponse({ error: 'Not found' }, false, 404)
    );
    const result = await fetchApi('clients/999', { method: 'GET' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe('Not found');
  });

  it('uses fallback error "Error en la petición" when server sends no error field', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(
      mockFetchResponse({}, false, 500)
    );
    const result = await fetchApi('test', { method: 'GET' });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Error en la petición');
  });

  it('returns { ok: false, status: 500 } when fetch itself throws (network error)', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    const result = await fetchApi('test', { method: 'GET' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe('Network error');
  });

  it('returns { error: "Error desconocido" } when a non-Error is thrown', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce('string error');
    const result = await fetchApi('test', { method: 'GET' });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Error desconocido');
  });
});

describe('get()', () => {
  it('calls fetch with method GET', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(mockFetchResponse({}));
    await get('clients');
    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(callArgs.method).toBe('GET');
  });
});

describe('post()', () => {
  it('calls fetch with method POST and serialized body', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(mockFetchResponse({}));
    await post('clients', { name: 'New Client' });
    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(callArgs.method).toBe('POST');
    expect(callArgs.body).toBe(JSON.stringify({ name: 'New Client' }));
  });
});

describe('put()', () => {
  it('calls fetch with method PUT and serialized body', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(mockFetchResponse({}));
    await put('clients/1', { name: 'Updated Client' });
    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(callArgs.method).toBe('PUT');
    expect(callArgs.body).toBe(JSON.stringify({ name: 'Updated Client' }));
  });
});

describe('patch()', () => {
  it('calls fetch with method PATCH and serialized body', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(mockFetchResponse({}));
    await patch('clients/1', { name: 'Patched Client' });
    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(callArgs.method).toBe('PATCH');
  });
});

describe('del()', () => {
  it('calls fetch with method DELETE', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(mockFetchResponse({}));
    await del('clients/1');
    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(callArgs.method).toBe('DELETE');
  });

  it('sends no body when data is omitted', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(mockFetchResponse({}));
    await del('clients/1');
    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(callArgs.body).toBeUndefined();
  });

  it('includes serialized body when data is provided', async () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(mockFetchResponse({}));
    await del('clients/1', { reason: 'test' });
    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(callArgs.body).toBe(JSON.stringify({ reason: 'test' }));
  });
});
