import { createRouter } from 'remix/fetch-router'
import { staticFiles } from 'remix/static-middleware'

import {
  apiChat,
  apiAnnotationAssist,
  apiAnnotations,
  apiChickNames,
  apiIngestObservation,
  apiIngestAudioSpectrum,
  apiLatestAudioSpectrum,
  apiLatest,
  apiManualNotes,
  apiObservations,
  apiReport,
  apiZones,
  dashboard,
  live,
  login,
  loginAction,
  logout,
  report,
} from './controllers/broodcast.tsx'
import { home } from './controllers/home.tsx'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [staticFiles('./public')],
})

router.map(routes.home, home)
router.map(routes.broodcast.index, live)
router.map(routes.broodcast.live, live)
router.map(routes.broodcast.dashboard, dashboard)
router.map(routes.broodcast.login.index, login)
router.map(routes.broodcast.login.action, loginAction)
router.map(routes.broodcast.logout, logout)
router.map(routes.broodcast.report, report)
router.map(routes.broodcast.api.ingestObservation, apiIngestObservation)
router.map(routes.broodcast.api.latest, apiLatest)
router.map(routes.broodcast.api.observations, apiObservations)
router.map(routes.broodcast.api.audio.latest, apiLatestAudioSpectrum)
router.map(routes.broodcast.api.audio.ingest, apiIngestAudioSpectrum)
router.map(routes.broodcast.api.chat, apiChat)
router.map(routes.broodcast.api.annotations.index, apiAnnotations)
router.map(routes.broodcast.api.annotations.action, apiAnnotations)
router.map(routes.broodcast.api.annotationAssist, apiAnnotationAssist)
router.map(routes.broodcast.api.chickNames, apiChickNames)
router.map(routes.broodcast.api.manualNotes, apiManualNotes)
router.map(routes.broodcast.api.zones, apiZones)
router.map(routes.broodcast.api.report, apiReport)
router.map(routes.api.ingestObservation, apiIngestObservation)
router.map(routes.api.latest, apiLatest)
router.map(routes.api.observations, apiObservations)
router.map(routes.api.audio.latest, apiLatestAudioSpectrum)
router.map(routes.api.audio.ingest, apiIngestAudioSpectrum)
router.map(routes.api.chat, apiChat)
router.map(routes.api.annotations.index, apiAnnotations)
router.map(routes.api.annotations.action, apiAnnotations)
router.map(routes.api.annotationAssist, apiAnnotationAssist)
router.map(routes.api.chickNames, apiChickNames)
router.map(routes.api.manualNotes, apiManualNotes)
router.map(routes.api.zones, apiZones)
router.map(routes.api.report, apiReport)
