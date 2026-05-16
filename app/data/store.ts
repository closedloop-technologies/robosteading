import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

export type Detection = {
  track_id: string
  class_name?: string
  chicken_id?: string | null
  identity_confidence?: number | null
  mask_ref?: string | null
  zone: string
  bbox: number[]
  centroid: number[]
  activity: string
  confidence: number
}

export type ObservationStats = {
  chick_count?: number
  heater_zone_pct_10m?: number
  food_water_zone_pct_10m?: number
  movement_score?: number
  feeding_time_pct_10m?: number
  drinking_time_pct_10m?: number
  poop_events_10m?: number
  peep_count_10m?: number
  peep_rate_per_minute?: number
  peep_intensity?: 'none' | 'low' | 'moderate' | 'high'
  peep_trend?: 'unknown' | 'rising' | 'steady' | 'falling'
  [key: string]: unknown
}

export type Observation = {
  id: string
  created_at: string
  observed_at: string
  family_id: string
  location_id: string
  camera_id: string
  camera_attachment_id: string
  model_version_id: string
  calibration_version: string
  frame_id: string | null
  annotated_frame_url: string | null
  raw_media_uploaded: boolean
  view_health: 'ok' | 'degraded' | 'camera_moved' | 'camera_blocked' | 'camera_fallen' | 'unknown'
  comfort_score: number | null
  summary: string
  alerts: string[]
  stats: ObservationStats
  objects: SceneObject[]
  events: SceneEvent[]
  audio: ObservationAudio | null
  detections: Detection[]
}

export type PeepEvent = {
  timestamp: string
  duration_ms: number
  dominant_frequency_hz: number
  peak_level_dbfs: number | string
  confidence: number
}

export type ObservationAudio = {
  source?: string
  raw_audio_uploaded: false
  human_voice_uploaded: false
  window_seconds?: number
  sample_rate_hz?: number
  filter_band_hz?: number[]
  events: PeepEvent[]
}

export type SceneObject = {
  track_id: string
  class?: string
  class_name?: string
  zone?: string
  bbox?: number[]
  mask_ref?: string | null
  confidence?: number
  privacy?: {
    biometric_identity_allowed?: boolean
    publicly_visible?: boolean
  }
}

export type SceneEvent = {
  event_type: string
  started_at: string
  ended_at?: string | null
  zone?: string | null
  actor_type?: string | null
  evidence_object_track_ids?: string[]
  confidence?: number
  review_state?: 'unreviewed' | 'needs_review' | 'reviewed'
  source?: 'human' | 'local_model' | 'frontier_llm' | 'imported'
}

export type ManualNote = {
  id: string
  created_at: string
  note: string
  visibility: 'private' | 'public'
}

export type BrooderZone = {
  name: string
  polygon: number[][]
  color: string
  active: boolean
}

export type BrooderAnnotation = {
  id: string
  created_at: string
  label: string
  kind: 'box' | 'corners' | 'point'
  color: string
  observation_id: string | null
  frame_id: string | null
  box: number[] | null
  corners: number[][] | null
  point: number[] | null
  image_size: number[] | null
  created_by: string
  source: 'human' | 'local_model' | 'frontier_llm' | 'imported'
  consent_state: 'local_only' | 'approved_for_training' | 'approved_for_frontier_llm'
}

export type ChickIdentity = {
  id: string
  created_at: string
  updated_at: string
  track_id: string
  name: string
  observation_id: string | null
  example_bbox: number[] | null
}

export type CareComplianceState = {
  heatSource: { status: 'checked' | 'needs_check' | 'unknown'; lastCheckedAt?: string }
  food: {
    status: 'checked' | 'needs_check' | 'unknown'
    lastCheckedAt?: string
    extraFoodGiven?: 'none' | 'corn_cob' | 'watermelon_rind' | 'other'
  }
  water: { status: 'checked' | 'needs_check' | 'unknown'; lastCheckedAt?: string }
  enclosure: { chickCount: number | null; status: 'secure' | 'needs_check' | 'unknown'; lastCheckedAt?: string }
  environment: { ambientStatus: 'ok' | 'too_cold' | 'too_hot' | 'unknown'; draftRisk: 'low' | 'unknown' }
  petSafety: { status: 'confirmed' | 'needs_check'; lastCheckedAt?: string }
  handling: { mode: 'none' | 'supervised' | 'unknown'; lastHandledAt?: string }
  outdoorTime: { mode: 'indoor_brooder' | 'outdoor_supervised' | 'transport' | 'unknown'; startedAt?: string }
  cleaning: {
    beddingStatus: 'clean' | 'soiled' | 'needs_check' | 'unknown'
    lastPadChangeAt?: string
    fakeGrassStatus: 'clean' | 'drying' | 'in_brooder' | 'unknown'
  }
  nighttime: { coverStatus: 'covered' | 'not_covered' | 'needs_check' | 'unknown'; bedtimeChecklistComplete: boolean }
  supervision: { lastAdultCheckAt?: string; status: 'supervised' | 'needs_adult_check' | 'unknown' }
  returnTransport: {
    ready: boolean
    heatSourceRemoved: boolean
    waterContainerRemoved: boolean
    foodContainerRemoved: boolean
    itemsInProvidedBag: boolean
    chicksSecured: boolean
  }
  updatedAt: string
}

type StoreState = {
  observations: Observation[]
  manualNotes: ManualNote[]
  zones: BrooderZone[]
  annotations: BrooderAnnotation[]
  chickIdentities: ChickIdentity[]
  compliance: CareComplianceState
  publicVisible: boolean
}

const storePath = join(process.cwd(), 'tmp', 'broodcast-store.json')

const defaultZones: BrooderZone[] = [
  { name: 'heater', polygon: [[180, 230], [520, 230], [520, 600], [180, 600]], color: '#ef4444', active: true },
  { name: 'turf', polygon: [[560, 300], [820, 300], [820, 620], [560, 620]], color: '#22c55e', active: true },
  { name: 'food_water', polygon: [[80, 620], [500, 620], [500, 880], [80, 880]], color: '#0ea5e9', active: true },
  { name: 'cool', polygon: [[520, 120], [900, 120], [900, 300], [520, 300]], color: '#a855f7', active: true },
]

let state: StoreState | null = null
let writeQueue = Promise.resolve()

function defaultState(): StoreState {
  return {
    observations: [],
    manualNotes: [],
    zones: defaultZones,
    annotations: [],
    chickIdentities: [],
    compliance: defaultCompliance(),
    publicVisible: true,
  }
}

function defaultCompliance(): CareComplianceState {
  return {
    heatSource: { status: 'unknown' },
    food: { status: 'unknown', extraFoodGiven: 'none' },
    water: { status: 'unknown' },
    enclosure: { chickCount: null, status: 'unknown' },
    environment: { ambientStatus: 'unknown', draftRisk: 'unknown' },
    petSafety: { status: 'needs_check' },
    handling: { mode: 'none' },
    outdoorTime: { mode: 'indoor_brooder' },
    cleaning: { beddingStatus: 'unknown', fakeGrassStatus: 'unknown' },
    nighttime: { coverStatus: 'unknown', bedtimeChecklistComplete: false },
    supervision: { status: 'unknown' },
    returnTransport: {
      ready: false,
      heatSourceRemoved: false,
      waterContainerRemoved: false,
      foodContainerRemoved: false,
      itemsInProvidedBag: false,
      chicksSecured: false,
    },
    updatedAt: new Date(0).toISOString(),
  }
}

async function loadState() {
  if (state) return state

  try {
    state = JSON.parse(await readFile(storePath, 'utf8')) as StoreState
    state.annotations ??= []
    state.chickIdentities ??= []
    state.compliance = { ...defaultCompliance(), ...(state.compliance ?? {}) }
  } catch {
    state = defaultState()
    await persist()
  }

  return state
}

async function persist() {
  if (!state) return

  await mkdir(dirname(storePath), { recursive: true })
  let snapshot = JSON.stringify(state, null, 2)
  writeQueue = writeQueue.then(() => writeFile(storePath, snapshot))
  await writeQueue
}

export async function listObservations(minutes = 30) {
  let current = await loadState()
  let cutoff = Date.now() - minutes * 60 * 1000
  return current.observations.filter((observation) => Date.parse(observation.observed_at) >= cutoff)
}

export async function allObservations() {
  let current = await loadState()
  return current.observations
}

export async function latestObservation() {
  let current = await loadState()
  return current.observations[0] ?? null
}

export async function addObservation(input: Partial<Observation> & { timestamp?: string }) {
  let current = await loadState()
  let now = new Date().toISOString()
  let observation: Observation = {
    id: randomUUID(),
    created_at: now,
    observed_at: input.observed_at ?? input.timestamp ?? now,
    family_id: stringOrDefault(input.family_id, 'family_local_dev'),
    location_id: stringOrDefault(input.location_id, 'garage_brooder'),
    camera_id: stringOrDefault(input.camera_id, 'laptop_webcam_1'),
    camera_attachment_id: stringOrDefault(input.camera_attachment_id, 'garage_brooder_laptop_webcam_2026_05'),
    model_version_id: stringOrDefault(input.model_version_id, 'local-yolo-rfdetr-2026-05-16'),
    calibration_version: stringOrDefault(input.calibration_version, 'zones-2026-05-16-a'),
    frame_id: input.frame_id ?? null,
    annotated_frame_url: input.annotated_frame_url ?? null,
    raw_media_uploaded: input.raw_media_uploaded === true,
    view_health: normalizeViewHealth(input.view_health),
    comfort_score: typeof input.comfort_score === 'number' ? input.comfort_score : null,
    summary: input.summary ?? 'No summary provided.',
    alerts: Array.isArray(input.alerts) ? input.alerts : [],
    stats: input.stats ?? {},
    objects: Array.isArray(input.objects) ? input.objects : [],
    events: Array.isArray(input.events) ? input.events : [],
    audio: normalizeAudio(input.audio),
    detections: Array.isArray(input.detections) ? input.detections : [],
  }

  current.observations = [observation, ...current.observations].slice(0, 1500)
  await persist()
  return observation
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeViewHealth(value: unknown): Observation['view_health'] {
  return value === 'ok' ||
    value === 'degraded' ||
    value === 'camera_moved' ||
    value === 'camera_blocked' ||
    value === 'camera_fallen'
    ? value
    : 'unknown'
}

function normalizeAudio(value: unknown): ObservationAudio | null {
  if (!value || typeof value !== 'object') return null
  let input = value as Record<string, unknown>
  let events = Array.isArray(input.events)
    ? input.events.map(normalizePeepEvent).filter((event): event is PeepEvent => event !== null).slice(0, 200)
    : []
  return {
    source: typeof input.source === 'string' ? input.source : 'local_mic_frequency_filter',
    raw_audio_uploaded: false,
    human_voice_uploaded: false,
    window_seconds: typeof input.window_seconds === 'number' ? input.window_seconds : undefined,
    sample_rate_hz: typeof input.sample_rate_hz === 'number' ? input.sample_rate_hz : undefined,
    filter_band_hz: Array.isArray(input.filter_band_hz) ? input.filter_band_hz.map(Number).slice(0, 2) : undefined,
    events,
  }
}

function normalizePeepEvent(value: unknown): PeepEvent | null {
  if (!value || typeof value !== 'object') return null
  let input = value as Record<string, unknown>
  return {
    timestamp: typeof input.timestamp === 'string' ? input.timestamp : new Date().toISOString(),
    duration_ms: finiteNumber(input.duration_ms, 0),
    dominant_frequency_hz: finiteNumber(input.dominant_frequency_hz, 0),
    peak_level_dbfs:
      typeof input.peak_level_dbfs === 'number' || typeof input.peak_level_dbfs === 'string'
        ? input.peak_level_dbfs
        : 'unknown',
    confidence: Math.max(0, Math.min(1, finiteNumber(input.confidence, 0))),
  }
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export async function addManualNote(note: string, visibility: 'private' | 'public') {
  let current = await loadState()
  let manualNote: ManualNote = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    note,
    visibility,
  }
  current.manualNotes = [manualNote, ...current.manualNotes].slice(0, 300)
  await persist()
  return manualNote
}

export async function listManualNotes(options: { includePrivate?: boolean } = {}) {
  let current = await loadState()
  return options.includePrivate
    ? current.manualNotes
    : current.manualNotes.filter((note) => note.visibility === 'public')
}

export async function getZones() {
  let current = await loadState()
  return current.zones
}

export async function replaceZones(zones: BrooderZone[]) {
  let current = await loadState()
  current.zones = zones
  await persist()
  return current.zones
}

export async function isPublicVisible() {
  let current = await loadState()
  return current.publicVisible
}

export async function setPublicVisible(visible: boolean) {
  let current = await loadState()
  current.publicVisible = visible
  await persist()
}

export async function listAnnotations() {
  let current = await loadState()
  return current.annotations
}

export async function addAnnotation(input: {
  label: string
  kind: 'box' | 'corners' | 'point'
  color?: string
  observation_id?: string | null
  frame_id?: string | null
  box?: number[] | null
  corners?: number[][] | null
  point?: number[] | null
  image_size?: number[] | null
  created_by?: string
  source?: 'human' | 'local_model' | 'frontier_llm' | 'imported'
  consent_state?: 'local_only' | 'approved_for_training' | 'approved_for_frontier_llm'
}) {
  let current = await loadState()
  let annotation: BrooderAnnotation = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    label: input.label,
    kind: input.kind,
    color: input.color ?? '#f59e0b',
    observation_id: input.observation_id ?? null,
    frame_id: input.frame_id ?? null,
    box: input.box ?? null,
    corners: input.corners ?? null,
    point: input.point ?? null,
    image_size: input.image_size ?? null,
    created_by: input.created_by ?? 'kid',
    source: input.source ?? 'human',
    consent_state: input.consent_state ?? 'local_only',
  }
  current.annotations = [annotation, ...current.annotations].slice(0, 500)
  await persist()
  return annotation
}

export async function getCompliance() {
  let current = await loadState()
  return withComplianceReminders(current.compliance, await latestObservation())
}

export async function updateCompliance(action: string, value?: string) {
  let current = await loadState()
  let now = new Date().toISOString()
  let compliance = current.compliance

  switch (action) {
    case 'heat_checked':
      compliance.heatSource = { status: 'checked', lastCheckedAt: now }
      break
    case 'water_checked':
      compliance.water = { status: 'checked', lastCheckedAt: now }
      break
    case 'food_checked':
      compliance.food = { ...compliance.food, status: 'checked', lastCheckedAt: now }
      break
    case 'extra_food':
      compliance.food = {
        ...compliance.food,
        extraFoodGiven:
          value === 'corn_cob' || value === 'watermelon_rind' || value === 'other' ? value : 'none',
      }
      break
    case 'enclosure_secure':
      compliance.enclosure = { ...compliance.enclosure, status: 'secure', lastCheckedAt: now }
      break
    case 'pets_away':
      compliance.petSafety = { status: 'confirmed', lastCheckedAt: now }
      break
    case 'adult_check':
      compliance.supervision = { status: 'supervised', lastAdultCheckAt: now }
      break
    case 'bedding_clean':
      compliance.cleaning = { ...compliance.cleaning, beddingStatus: 'clean' }
      break
    case 'pad_replaced':
      compliance.cleaning = { ...compliance.cleaning, beddingStatus: 'clean', lastPadChangeAt: now }
      break
    case 'fake_grass_cleaned':
      compliance.cleaning = { ...compliance.cleaning, fakeGrassStatus: 'clean' }
      break
    case 'fake_grass_drying':
      compliance.cleaning = { ...compliance.cleaning, fakeGrassStatus: 'drying' }
      break
    case 'fake_grass_returned':
      compliance.cleaning = { ...compliance.cleaning, fakeGrassStatus: 'in_brooder' }
      break
    case 'handling_started':
      compliance.handling = { mode: 'supervised', lastHandledAt: now }
      break
    case 'handling_ended':
      compliance.handling = { mode: 'none', lastHandledAt: now }
      break
    case 'outdoor_started':
      compliance.outdoorTime = { mode: 'outdoor_supervised', startedAt: now }
      break
    case 'outdoor_ended':
      compliance.outdoorTime = { mode: 'indoor_brooder' }
      break
    case 'night_cover_on':
      compliance.nighttime = { ...compliance.nighttime, coverStatus: 'covered' }
      break
    case 'night_cover_off':
      compliance.nighttime = { ...compliance.nighttime, coverStatus: 'not_covered' }
      break
    case 'bedtime_complete':
      compliance.nighttime = { ...compliance.nighttime, bedtimeChecklistComplete: true }
      break
    case 'transport_heat_removed':
      compliance.returnTransport.heatSourceRemoved = true
      break
    case 'transport_water_removed':
      compliance.returnTransport.waterContainerRemoved = true
      break
    case 'transport_food_removed':
      compliance.returnTransport.foodContainerRemoved = true
      break
    case 'transport_items_bagged':
      compliance.returnTransport.itemsInProvidedBag = true
      break
    case 'transport_chicks_secured':
      compliance.returnTransport.chicksSecured = true
      break
    default:
      throw new Error('Unknown care checklist action.')
  }

  compliance.returnTransport.ready =
    compliance.returnTransport.heatSourceRemoved &&
    compliance.returnTransport.waterContainerRemoved &&
    compliance.returnTransport.foodContainerRemoved &&
    compliance.returnTransport.itemsInProvidedBag &&
    compliance.returnTransport.chicksSecured
  compliance.updatedAt = now
  await persist()
  return withComplianceReminders(compliance, await latestObservation())
}

export async function peepActivity(minutes = 60) {
  let observations = await listObservations(minutes)
  let events = observations.flatMap((observation) => observation.audio?.events ?? [])
  let bucketMap = new Map<string, { start: string; end: string; peep_count: number; rates: number[]; intensities: string[] }>()

  for (let observation of observations) {
    let startDate = new Date(Math.floor(Date.parse(observation.observed_at) / 300000) * 300000)
    if (!Number.isFinite(startDate.getTime())) continue
    let key = startDate.toISOString()
    let bucket =
      bucketMap.get(key) ??
      {
        start: key,
        end: new Date(startDate.getTime() + 300000).toISOString(),
        peep_count: 0,
        rates: [],
        intensities: [],
      }
    bucket.peep_count += Number(observation.stats.peep_count_10m ?? observation.audio?.events.length ?? 0)
    if (typeof observation.stats.peep_rate_per_minute === 'number') bucket.rates.push(observation.stats.peep_rate_per_minute)
    if (typeof observation.stats.peep_intensity === 'string') bucket.intensities.push(observation.stats.peep_intensity)
    bucketMap.set(key, bucket)
  }

  return {
    minutes,
    raw_audio_available: false,
    events: events.slice(0, 200),
    buckets: [...bucketMap.values()]
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((bucket) => ({
        start: bucket.start,
        end: bucket.end,
        peep_count: bucket.peep_count,
        peep_rate_per_minute:
          bucket.rates.length > 0 ? bucket.rates.reduce((sum, rate) => sum + rate, 0) / bucket.rates.length : 0,
        peep_intensity: strongestIntensity(bucket.intensities),
      })),
  }
}

function strongestIntensity(values: string[]) {
  let order = ['none', 'low', 'moderate', 'high']
  return values.sort((a, b) => order.indexOf(b) - order.indexOf(a))[0] ?? 'none'
}

function withComplianceReminders(compliance: CareComplianceState, latest: Observation | null) {
  let next = structuredClone(compliance) as CareComplianceState
  let now = Date.now()
  let stale = (timestamp: string | undefined, hours: number) => !timestamp || now - Date.parse(timestamp) > hours * 60 * 60 * 1000

  if (stale(next.water.lastCheckedAt, 4)) next.water.status = 'needs_check'
  if (stale(next.food.lastCheckedAt, 4)) next.food.status = 'needs_check'
  if (stale(next.heatSource.lastCheckedAt, 4)) next.heatSource.status = 'needs_check'
  if (stale(next.petSafety.lastCheckedAt, 4)) next.petSafety.status = 'needs_check'
  if (stale(next.supervision.lastAdultCheckAt, 3)) next.supervision.status = 'needs_adult_check'

  let chickCount = latest?.stats.chick_count ?? latest?.detections.length ?? null
  next.enclosure.chickCount = typeof chickCount === 'number' ? chickCount : null
  if (typeof chickCount === 'number' && chickCount < 2) next.enclosure.status = 'needs_check'
  return next
}

export async function listChickIdentities() {
  let current = await loadState()
  return current.chickIdentities
}

export async function upsertChickIdentity(input: {
  track_id: string
  name: string
  observation_id?: string | null
  example_bbox?: number[] | null
}) {
  let current = await loadState()
  let now = new Date().toISOString()
  let existing = current.chickIdentities.find((identity) => identity.track_id === input.track_id)
  if (existing) {
    existing.name = input.name
    existing.updated_at = now
    existing.observation_id = input.observation_id ?? existing.observation_id
    existing.example_bbox = input.example_bbox ?? existing.example_bbox
    await persist()
    return existing
  }

  let identity: ChickIdentity = {
    id: randomUUID(),
    created_at: now,
    updated_at: now,
    track_id: input.track_id,
    name: input.name,
    observation_id: input.observation_id ?? null,
    example_bbox: input.example_bbox ?? null,
  }
  current.chickIdentities = [identity, ...current.chickIdentities].slice(0, 100)
  await persist()
  return identity
}
