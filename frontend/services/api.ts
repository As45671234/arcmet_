
export function getAdminToken() {
  return localStorage.getItem('arcmet_admin_token') || '';
}

export function setAdminToken(token: string) {
  localStorage.setItem('arcmet_admin_token', token);
}

export function clearAdminToken() {
  localStorage.removeItem('arcmet_admin_token');
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.headers) {
    Object.assign(headers, options.headers as any);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let msg = 'Ошибка запроса';
    try {
      const data = await res.json();
      msg = data?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}

export async function fetchCatalog() {
  return request<{ categories: any[] }>('/api/catalog');
}

export async function adminLogin(password: string) {
  return request<{ token: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function fetchAdminCatalog(token: string) {
  return request<{ categories: any[] }>('/api/admin/catalog', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminImportExcel(token: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);

  const res = await fetch('/api/admin/import/excel', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  if (!res.ok) {
    let msg = 'Ошибка импорта';
    try {
      const data = await res.json();
      msg = data?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}

export async function adminUploadProductImage(token: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);

  const res = await fetch('/api/admin/upload/product-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  if (!res.ok) {
    let msg = 'Ошибка загрузки изображения';
    try {
      const data = await res.json();
      msg = data?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json() as Promise<{ ok: boolean; imageUrl: string }>;
}

export async function adminPatchProduct(token: string, id: string, patch: any) {
  return request<{ product: any }>(`/api/admin/products/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  });
}

export async function adminDeleteProduct(token: string, id: string) {
  return request<{ ok: boolean }>(`/api/admin/products/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminCreateProduct(token: string, body: any) {
  return request<{ product: any }>(`/api/admin/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export async function sendLead(data: { name: string; phone: string; email?: string; message?: string; }) {
  return request<{ ok: boolean }>(`/api/leads/email`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function sendOrder(data: any) {
  return request<{ ok: boolean; id: string }>(`/api/orders`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function adminFetchOrders(token: string, params: { page?: number; limit?: number; status?: string; sortBy?: string; sortDir?: string } = {}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.status) q.set('status', params.status);
  if (params.sortBy) q.set('sortBy', params.sortBy);
  if (params.sortDir) q.set('sortDir', params.sortDir);

  const qs = q.toString();
  return request<{ page: number; limit: number; total: number; items: any[] }>(`/api/admin/orders${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminFetchOrder(token: string, id: string) {
  return request<{ order: any }>(`/api/admin/orders/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminPatchOrder(token: string, id: string, status: string) {
  return request<{ ok: boolean; status: string }>(`/api/admin/orders/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
}

export async function adminDeleteOrder(token: string, id: string) {
  return request<{ ok: boolean }>(`/api/admin/orders/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminExportOrder(token: string, id: string) {
  const res = await fetch(`/api/admin/orders/${id}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let msg = 'Ошибка экспорта';
    try {
      const data = await res.json();
      msg = data?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  const blob = await res.blob();
  return blob;
}

// --------------------
// Leads (Admin)
// --------------------
export async function adminFetchLeads(token: string, params: { page?: number; limit?: number; status?: string; sortDir?: string } = {}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.status) q.set('status', params.status);
  if (params.sortDir) q.set('sortDir', params.sortDir);
  const qs = q.toString();

  return request<{ page: number; limit: number; total: number; items: any[] }>(`/api/admin/leads${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminFetchLead(token: string, id: string) {
  return request<{ lead: any }>(`/api/admin/leads/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminPatchLead(token: string, id: string, status: string) {
  return request<{ ok: boolean; status: string }>(`/api/admin/leads/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
}

export async function adminDeleteLead(token: string, id: string) {
  return request<{ ok: boolean }>(`/api/admin/leads/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
