import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiClient } from './api';
afterEach(() => vi.unstubAllGlobals());
describe('same-origin API transport', () => {
  it('turns a backend validation response into an actionable error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:'Title is required'}), {status:422})));
    await expect(new ApiClient().get('/tasks')).rejects.toThrow('Title is required');
  });
  it('bootstraps a session before a write and attaches CSRF without leaking record metadata', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({csrf_token:'local-token',workspace:{name:'Harbor'}}))).mockResolvedValueOnce(new Response(JSON.stringify({id:'t1',title:'Review access'})));
    vi.stubGlobal('fetch', fetcher);
    const api = new ApiClient();
    const result = await api.post('/tasks', {title:'Review access'});
    expect(result).toEqual({id:'t1',title:'Review access'});
    expect(fetcher.mock.calls[0][0]).toBe('/api/bootstrap');
    const [url, options] = fetcher.mock.calls[1];
    expect(url).toBe('/api/tasks');
    expect(options.credentials).toBe('same-origin');
    expect(new Headers(options.headers).get('X-CSRF-Token')).toBe('local-token');
    expect(JSON.parse(options.body)).toEqual({title:'Review access'});
  });
});