const API_BASE = '/api';
const TOKEN_KEY = 'estoque_pro_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getHeaders(custom = {}, overrideToken = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...custom
  };
  const token = overrideToken || getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchApi(path, options = {}, overrideToken = null) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: 'same-origin',
      ...options,
      headers: getHeaders(options.headers || {}, overrideToken)
    });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : { success: false, error: await response.text() };
    if (!response.ok || !payload.success) {
      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
      }
      return { success: false, error: payload.error || `Erro HTTP ${response.status}` };
    }
    return payload;
  } catch (error) {
    return { success: false, error: 'Erro de conexão. Verifique sua rede.' };
  }
}

export async function login(senha, pin) {
  return fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ senha, pin })
  });
}

export async function fetchInventory() {
  return fetchApi('/estoque');
}

export async function fetchTechnicians() {
  return fetchApi('/tecnicos');
}

export async function fetchCriticalItems() {
  return fetchApi('/criticos');
}

export async function fetchLogs() {
  return fetchApi('/logs');
}

export async function postRetirada(payload, token = null) {
  return fetchApi('/retirada', {
    method: 'POST',
    body: JSON.stringify(payload)
  }, token);
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredToken() {
  return getToken();
}
