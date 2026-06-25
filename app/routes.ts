import { get, post, route } from 'remix/fetch-router/routes'

export const routes = route({
  home: '/',
  broodcast: route('broodcast', {
    index: get('/'),
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
      peeps: get('/api/peeps'),
      compliance: {
        latest: get('/api/compliance'),
        action: post('/api/compliance'),
      },
      audio: {
        latest: get('/api/audio/latest'),
        ingest: post('/api/audio/spectrum'),
      },
      chat: post('/api/chat'),
      annotations: {
        index: get('/api/annotations'),
        action: post('/api/annotations'),
      },
      annotationAssist: post('/api/annotation-assist'),
      chickNames: post('/api/chick-names'),
      manualNotes: post('/api/manual-notes'),
      zones: post('/api/zones'),
      report: get('/api/report'),
    },
  }),
  api: {
    ingestObservation: post('/api/ingest/observation'),
    latest: get('/api/latest'),
    observations: get('/api/observations'),
    peeps: get('/api/peeps'),
    compliance: {
      latest: get('/api/compliance'),
      action: post('/api/compliance'),
    },
    audio: {
      latest: get('/api/audio/latest'),
      ingest: post('/api/audio/spectrum'),
    },
    chat: post('/api/chat'),
    annotations: {
      index: get('/api/annotations'),
      action: post('/api/annotations'),
    },
    annotationAssist: post('/api/annotation-assist'),
    chickNames: post('/api/chick-names'),
    manualNotes: post('/api/manual-notes'),
    zones: post('/api/zones'),
    report: get('/api/report'),
  },
})
