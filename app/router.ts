import { createRouter } from 'remix/fetch-router'
import { staticFiles } from 'remix/static-middleware'

import {
  apiChat,
  apiIngestObservation,
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
} from './controllers/chickcoach.tsx'
import { home } from './controllers/home.tsx'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [staticFiles('./public')],
})

router.map(routes.home, home)
router.map(routes.chickcheck.index, live)
router.map(routes.chickcheck.live, live)
router.map(routes.chickcheck.dashboard, dashboard)
router.map(routes.chickcheck.login.index, login)
router.map(routes.chickcheck.login.action, loginAction)
router.map(routes.chickcheck.logout, logout)
router.map(routes.chickcheck.report, report)
router.map(routes.chickcheck.api.ingestObservation, apiIngestObservation)
router.map(routes.chickcheck.api.latest, apiLatest)
router.map(routes.chickcheck.api.observations, apiObservations)
router.map(routes.chickcheck.api.chat, apiChat)
router.map(routes.chickcheck.api.manualNotes, apiManualNotes)
router.map(routes.chickcheck.api.zones, apiZones)
router.map(routes.chickcheck.api.report, apiReport)
router.map(routes.api.ingestObservation, apiIngestObservation)
router.map(routes.api.latest, apiLatest)
router.map(routes.api.observations, apiObservations)
router.map(routes.api.chat, apiChat)
router.map(routes.api.manualNotes, apiManualNotes)
router.map(routes.api.zones, apiZones)
router.map(routes.api.report, apiReport)
