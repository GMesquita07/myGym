const base = import.meta.env.VITE_API_URL || ''

async function request(path, options = {}) {
  const response = await fetch(`${base}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    let body = {}
    try { body = await response.json() } catch { /* resposta sem JSON */ }
    throw new Error(body.message || body.detail || `Erro ${response.status}. Tenta novamente.`)
  }
  return response.status === 204 ? null : response.json()
}

export const api = {
  plans: () => request('/plans'),
  createPlan: (body) => request('/plans', { method: 'POST', body: JSON.stringify(body) }),
  updatePlan: (id, body) => request(`/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePlan: (id) => request(`/plans/${id}`, { method: 'DELETE' }),
  sessions: () => request('/sessions'),
  session: (id) => request(`/sessions/${id}`),
  start: (planId) => request(`/plans/${planId}/sessions`, { method: 'POST' }),
  addSet: (sessionId, exerciseId, body) => request(`/sessions/${sessionId}/exercises/${exerciseId}/sets`, { method: 'POST', body: JSON.stringify(body) }),
  removeSet: (sessionId, exerciseId, setId) => request(`/sessions/${sessionId}/exercises/${exerciseId}/sets/${setId}`, { method: 'DELETE' }),
  complete: (sessionId, notes) => request(`/sessions/${sessionId}/complete`, { method: 'POST', body: JSON.stringify({ notes }) }),
}
