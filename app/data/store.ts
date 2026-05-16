import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

export type Detection = {
  track_id: string
  class_name?: string
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
  [key: string]: unknown
}

export type Observation = {
  id: string
  created_at: string
  observed_at: string
  frame_id: string | null
  annotated_frame_url: string | null
  comfort_score: number | null
  summary: string
  alerts: string[]
  stats: ObservationStats
  detections: Detection[]
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
  kind: 'box' | 'point'
  color: string
  observation_id: string | null
  frame_id: string | null
  box: number[] | null
  point: number[] | null
  image_size: number[] | null
  created_by: string
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

type StoreState = {
  observations: Observation[]
  manualNotes: ManualNote[]
  zones: BrooderZone[]
  annotations: BrooderAnnotation[]
  chickIdentities: ChickIdentity[]
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
    publicVisible: true,
  }
}

async function loadState() {
  if (state) return state

  try {
    state = JSON.parse(await readFile(storePath, 'utf8')) as StoreState
    state.annotations ??= []
    state.chickIdentities ??= []
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
    frame_id: input.frame_id ?? null,
    annotated_frame_url: input.annotated_frame_url ?? null,
    comfort_score: typeof input.comfort_score === 'number' ? input.comfort_score : null,
    summary: input.summary ?? 'No summary provided.',
    alerts: Array.isArray(input.alerts) ? input.alerts : [],
    stats: input.stats ?? {},
    detections: Array.isArray(input.detections) ? input.detections : [],
  }

  current.observations = [observation, ...current.observations].slice(0, 1500)
  await persist()
  return observation
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
  kind: 'box' | 'point'
  color?: string
  observation_id?: string | null
  frame_id?: string | null
  box?: number[] | null
  point?: number[] | null
  image_size?: number[] | null
  created_by?: string
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
    point: input.point ?? null,
    image_size: input.image_size ?? null,
    created_by: input.created_by ?? 'kid',
  }
  current.annotations = [annotation, ...current.annotations].slice(0, 500)
  await persist()
  return annotation
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
