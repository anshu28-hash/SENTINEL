/**
 * Sentinel Financial Intelligence - API Client
 * Dynamically resolves API routes across local development,
 * serverless cloud deployments (Vercel), and cross-device clients.
 */

export function getApiBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/$/, '');
  }
  if (typeof window === 'undefined') {
    return '';
  }
  const { hostname, port } = window.location;
  // Local Vite Dev Server (port 5173): uses proxy to forward '/api' to backend
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '5173') {
    return '';
  }
  // Local dev running on an alternative unproxied port (e.g. vite preview): fallback to localhost:3000
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && port !== '3000' && port !== '') {
    return 'http://localhost:3000';
  }
  // In all deployed production environments (Vercel, Render, Railway, custom domain, mobile clients):
  // Empty string uses relative paths to the deployed origin without localhost failure or mixed-content blockage!
  return '';
}

export async function fetchHealth() {
  try {
    const res = await fetch(`${getApiBase()}/api/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('API fetchHealth fallback:', err.message);
    return null;
  }
}

export async function fetchStats() {
  try {
    const res = await fetch(`${getApiBase()}/api/stats`);
    if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('API fetchStats fallback:', err.message);
    return null;
  }
}

export async function fetchTransactions(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${getApiBase()}/api/transactions${query ? '?' + query : ''}`);
    if (!res.ok) throw new Error(`Transactions fetch failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('API fetchTransactions fallback:', err.message);
    return null;
  }
}

export async function fetchAlerts(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${getApiBase()}/api/alerts${query ? '?' + query : ''}`);
    if (!res.ok) throw new Error(`Alerts fetch failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('API fetchAlerts fallback:', err.message);
    return null;
  }
}

export async function fetchInvestigations(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${getApiBase()}/api/investigations${query ? '?' + query : ''}`);
    if (!res.ok) throw new Error(`Investigations fetch failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('API fetchInvestigations fallback:', err.message);
    return null;
  }
}

export async function saveAnalystDecision(id, outcome, notes) {
  try {
    const res = await fetch(`${getApiBase()}/api/investigations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, notes })
    });
    if (!res.ok) throw new Error(`Save decision failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('API saveAnalystDecision fallback:', err.message);
    return null;
  }
}

export async function triggerSimulatedTx(type = null) {
  try {
    const payload = type ? { type } : {};
    const res = await fetch(`${getApiBase()}/api/simulator/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Trigger status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('triggerSimulatedTx warning (will use resilient fallback):', err.message);
    return null;
  }
}

export function subscribeToLiveStream(onTransaction, onStatusChange) {
  let eventSource = null;
  let retryTimer = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;
    try {
      const url = `${getApiBase()}/api/stream`;
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        if (onStatusChange) onStatusChange(true);
      };

      eventSource.addEventListener('transaction', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (onTransaction) onTransaction(data);
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      });

      eventSource.onerror = () => {
        if (onStatusChange) onStatusChange(false);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isClosed) {
          retryTimer = setTimeout(connect, 6000);
        }
      };
    } catch (err) {
      console.warn('SSE subscription failed:', err.message);
      if (onStatusChange) onStatusChange(false);
      if (!isClosed) {
        retryTimer = setTimeout(connect, 6000);
      }
    }
  }

  connect();

  return () => {
    isClosed = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (eventSource) eventSource.close();
  };
}
