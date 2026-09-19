export class ApiClient {
  private csrf = '';
  private bootstrapRequest?: Promise<any>;

  async bootstrap<T = any>(): Promise<T> {
    if (!this.bootstrapRequest) {
      this.bootstrapRequest = this.get<any>('/bootstrap').then(data => {
        this.csrf = data.csrf_token;
        return data;
      }).catch(error => { this.bootstrapRequest = undefined; throw error; });
    }
    return this.bootstrapRequest;
  }

  async request<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const headers = new Headers();
    if (method !== 'GET') {
      if (!this.csrf) await this.bootstrap();
      headers.set('X-CSRF-Token', this.csrf);
    }
    const multipart = body instanceof FormData;
    if (body !== undefined && !multipart) headers.set('Content-Type', 'application/json');
    const response = await fetch(`/api${path}`, {method, credentials: 'same-origin', headers, body: body === undefined ? undefined : multipart ? body : JSON.stringify(body)});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.detail;
      const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((entry: any) => `${entry.loc?.slice(1).join('.') || 'Input'}: ${entry.msg || entry.message || 'Invalid value'}`).join('; ') : `Request failed (${response.status}). Please retry.`;
      throw new Error(message);
    }
    return data;
  }
  get<T = any>(path: string): Promise<T> { return this.request<T>(path); }
  post<T = any>(path: string, body?: unknown): Promise<T> { return this.request<T>(path, 'POST', body); }
  patch<T = any>(path: string, body: unknown): Promise<T> { return this.request<T>(path, 'PATCH', body); }
  delete<T = any>(path: string): Promise<T> { return this.request<T>(path, 'DELETE'); }
}
export const api = new ApiClient();
