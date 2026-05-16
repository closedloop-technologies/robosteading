import { get, post, route } from 'remix/fetch-router/routes'

export const routes = route({
  home: '/',
  live: get('/live'),
  dashboard: get('/dashboard'),
  login: {
    index: get('/login'),
    action: post('/login'),
  },
  logout: post('/logout'),
  report: get('/report'),
  api: {
    ingestObservation: post('/api/ingest/observation'),
    latest: get('/api/latest'),
    observations: get('/api/observations'),
    chat: post('/api/chat'),
    manualNotes: post('/api/manual-notes'),
    zones: post('/api/zones'),
    report: get('/api/report'),
  },
})
