const API_BASE = (typeof window !== 'undefined' && window.location.port === '5173')
  ? '' 
  : 'http://localhost:3000';

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch (err) {
    console.warn('API fetchHealth fallback:', err.message);
    return null;
  }
}

export async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) throw new Error('Stats fetch failed');
    return await res.json();
  } catch (err) {
    console.warn('API fetchStats fallback:', err.message);
    return null;
  }
}

export async function fetchTransactions(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/api/transactions${query ? '?' + query : ''}`);
    if (!res.ok) throw new Error('Transactions fetch failed');
    return await res.json();
  } catch (err) {
    console.warn('API fetchTransactions fallback:', err.message);
    return null;
  }
}

export async function fetchAlerts(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/api/alerts${query ? '?' + query : ''}`);
    if (!res.ok) throw new Error('Alerts fetch failed');
    return await res.json();
  } catch (err) {
    console.warn('API fetchAlerts fallback:', err.message);
    return null;
  }
}

export async function fetchInvestigations(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/api/investigations${query ? '?' + query : ''}`);
    if (!res.ok) throw new Error('Investigations fetch failed');
    return await res.json();
  } catch (err) {
    console.warn('API fetchInvestigations fallback:', err.message);
    return null;
  }
}

export async function saveAnalystDecision(id, outcome, notes) {
  try {
    const res = await fetch(`${API_BASE}/api/investigations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, notes })
    });
    if (!res.ok) throw new Error('Save decision failed');
    return await res.json();
  } catch (err) {
    console.warn('API saveAnalystDecision fallback:', err.message);
    return null;
  }
}

export async function triggerSimulatedTx(type = 'normal') {
  try {
    const res = await fetch(`${API_BASE}/api/simulator/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    return await res.json();
  } catch (err) {
    console.warn('triggerSimulatedTx error:', err.message);
    return null;
  }
}

export function subscribeToLiveStream(onTransaction) {
  let eventSource = null;
  try {
    eventSource = new EventSource(`${API_BASE}/api/stream`);
    eventSource.addEventListener('transaction', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (onTransaction) onTransaction(data);
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });
  } catch (err) {
    console.warn('SSE subscription failed:', err.message);
  }

  return () => {
    if (eventSource) eventSource.close();
  };
}
