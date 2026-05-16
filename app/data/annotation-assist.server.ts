import type { BrooderAnnotation, ChickIdentity, Detection, Observation } from './store.ts'
import { b } from './baml_client/baml_client/index.ts'

export type AnnotationAssistInput = {
  observation: Observation | null
  detections: Detection[]
  annotations: BrooderAnnotation[]
  chickIdentities: ChickIdentity[]
  draft: {
    kind?: 'box' | 'point'
    label?: string
    box?: number[] | null
    point?: number[] | null
    image_size?: number[] | null
  } | null
}

export type AnnotationAssistResult = {
  provider: 'kimi' | 'fallback'
  guidance: string
  suggestions: Array<{
    label: string
    kind: 'box' | 'point'
    reason: string
  }>
  quality_checks: string[]
}

const brooderLabels = ['chick', 'heater', 'water', 'food', 'waste', 'bedding']

export async function assistAnnotation(input: AnnotationAssistInput): Promise<AnnotationAssistResult> {
  if (kimiBaseUrl() && kimiApiKey() && kimiModel()) {
    let kimi = await assistWithBaml(input)
    if (kimi) return { provider: 'kimi', ...kimi }
  }

  return { provider: 'fallback', ...fallbackAssist(input) }
}

async function assistWithBaml(input: AnnotationAssistInput) {
  try {
    let result = await b.AssistBrooderAnnotation(
      toBamlObservation(input.observation),
      input.detections.slice(0, 12).map(toBamlDetection),
      input.annotations.slice(0, 20).map(toBamlAnnotation),
      input.chickIdentities.slice(0, 20).map((identity) => ({
        track_id: identity.track_id,
        name: identity.name,
      })),
      {
        label: input.draft?.label ?? null,
        kind: input.draft?.kind === 'point' ? 'point' : 'box',
        bounding_box: input.draft?.box ?? null,
        point: input.draft?.point ?? null,
        image_size: input.draft?.image_size ?? null,
      },
      {
        env: {
          KIMI_BASE_URL: kimiBaseUrl(),
          FIREWORKS_API_KEY: kimiApiKey(),
          KIMI_MODEL: kimiModel(),
        },
      },
    )
    return normalizeAssist(result)
  } catch (error) {
    console.error('BAML Kimi annotation assist failed, using fallback.', error)
    return null
  }
}

function fallbackAssist(input: AnnotationAssistInput): Omit<AnnotationAssistResult, 'provider'> {
  let draftLabel = String(input.draft?.label ?? '').trim().toLowerCase()
  let chickCount = input.observation?.stats.chick_count ?? input.detections.length
  let suggestions = [
    { label: 'waste', kind: 'box' as const, reason: 'Use this for poop, dark droppings, stains, or bedding debris.' },
    { label: 'food', kind: 'box' as const, reason: 'Use this for the feeder or spilled feed.' },
    { label: 'water', kind: 'box' as const, reason: 'Use this for the drinker or water line.' },
    { label: 'chick', kind: 'box' as const, reason: 'Use this only for a visible chick body.' },
  ]
  if (draftLabel) {
    suggestions = suggestions.filter((suggestion) => suggestion.label === draftLabel).concat(
      suggestions.filter((suggestion) => suggestion.label !== draftLabel),
    )
  }

  return {
    guidance:
      chickCount > 0
        ? 'Check each model chick box before saving; relabel poop or bedding as waste instead of chick.'
        : 'No reliable chick detections are active, so manually box only objects you can clearly identify.',
    suggestions: suggestions.slice(0, 4),
    quality_checks: [
      'Freeze the frame before drawing so the saved box matches the image.',
      'Make boxes snug around the object, not the whole brooder area.',
      'Use waste for poop and bedding debris.',
      'Use chick only when the body is visible.',
    ],
  }
}

function normalizeAssist(value: Partial<Omit<AnnotationAssistResult, 'provider'>> | null) {
  if (!value || typeof value.guidance !== 'string') return null
  let suggestions = Array.isArray(value.suggestions)
    ? value.suggestions
        .map((suggestion) => ({
          label: brooderLabels.includes(String(suggestion.label)) ? String(suggestion.label) : 'waste',
          kind: (suggestion.kind === 'point' ? 'point' : 'box') as 'box' | 'point',
          reason: typeof suggestion.reason === 'string' ? suggestion.reason : 'Suggested by Kimi.',
        }))
        .slice(0, 4)
    : []
  let qualityChecks = Array.isArray(value.quality_checks)
    ? value.quality_checks.filter((check): check is string => typeof check === 'string').slice(0, 4)
    : []
  return {
    guidance: value.guidance,
    suggestions,
    quality_checks: qualityChecks,
  }
}

function toBamlObservation(observation: Observation | null) {
  return {
    timestamp: observation?.observed_at ?? new Date(0).toISOString(),
    comfort_score: observation?.comfort_score ?? 0,
    summary: observation?.summary ?? 'No live observation is available.',
    alerts: observation?.alerts ?? [],
    heater_zone_pct_10m: observation?.stats.heater_zone_pct_10m ?? 0,
    food_water_zone_pct_10m: observation?.stats.food_water_zone_pct_10m ?? 0,
    movement_score: observation?.stats.movement_score ?? 0,
  }
}

function toBamlDetection(detection: Detection) {
  return {
    track_id: detection.track_id,
    class_name: detection.class_name ?? 'chick',
    bbox: detection.bbox,
    confidence: detection.confidence,
    zone: detection.zone ?? 'unknown',
    activity: detection.activity ?? 'unknown',
  }
}

function toBamlAnnotation(annotation: BrooderAnnotation) {
  return {
    label: annotation.label,
    kind: annotation.kind,
    bounding_box: annotation.box,
    point: annotation.point,
    frame_id: annotation.frame_id,
    created_by: annotation.created_by,
  }
}

function kimiBaseUrl() {
  return process.env.KIMI_BASE_URL ?? 'https://api.fireworks.ai/inference/v1'
}

function kimiApiKey() {
  return process.env.KIMI_API_KEY ?? process.env.FIREWORKS_API_KEY ?? ''
}

function kimiModel() {
  return process.env.KIMI_MODEL ?? 'accounts/fireworks/models/kimi-k2p6'
}
