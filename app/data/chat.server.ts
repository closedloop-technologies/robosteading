import { chickCareKnowledge } from './chick-care-kb.ts'
import type { ManualNote, Observation } from './store.ts'

export type ChickAnswer = {
  answer: string
  confidence: 'low' | 'medium' | 'high'
  safety_level: 'normal' | 'check_now' | 'adult_attention'
  suggested_checks: string[]
  evidence: string[]
  follow_up_questions: string[]
}

const concernWords = [
  'cold',
  'too hot',
  'overheat',
  'chill',
  'hurt',
  'injury',
  'injured',
  'lethargic',
  'lethargy',
  'stuck',
  'trapped',
  'breathing',
  'pasty',
  'distress',
  'peeping',
  'water',
  'food',
]

export async function answerChickQuestion(
  question: string,
  latest: Observation | null,
  recent: Observation[],
  notes: ManualNote[],
): Promise<ChickAnswer> {
  if (kimiBaseUrl() && kimiApiKey() && kimiModel()) {
    let kimiAnswer = await answerWithKimi(question, latest, recent, notes)
    if (kimiAnswer) return kimiAnswer
  }

  return fallbackAnswer(question, latest, recent, notes)
}

async function answerWithKimi(
  question: string,
  latest: Observation | null,
  recent: Observation[],
  notes: ManualNote[],
) {
  let prompt = `You are ChickCoach, a cautious educational assistant for a temporary chick brooder.

Return only JSON with these fields: answer, confidence, safety_level, suggested_checks, evidence, follow_up_questions.
confidence must be low, medium, or high. safety_level must be normal, check_now, or adult_attention.
Never diagnose health issues. Never say the system replaces adult supervision. Recommend direct adult checks for concerning situations.

Latest observation:
${JSON.stringify(toPromptObservation(latest), null, 2)}

Recent observations:
${JSON.stringify(recent.slice(0, 12).map(toPromptObservation), null, 2)}

Manual notes:
${JSON.stringify(notes.slice(0, 10).map((note) => note.note), null, 2)}

Chick care knowledge:
${JSON.stringify(chickCareKnowledge, null, 2)}

User question:
${question}`

  try {
    let response = await fetch(`${kimiBaseUrl().replace(/\/$/, '')}/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kimiApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: kimiModel(),
        max_tokens: 4096,
        top_p: 1,
        top_k: 40,
        presence_penalty: 0,
        frequency_penalty: 0,
        temperature: 0.1,
        prompt,
      }),
    })

    if (!response.ok) return null
    let payload = await response.json()
    let content = payload?.choices?.[0]?.text ?? payload?.choices?.[0]?.message?.content
    if (typeof content !== 'string') return null
    return normalizeAnswer(parseJsonObject(content))
  } catch (error) {
    console.error('Kimi chat failed, using fallback answer.', error)
    return null
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

function fallbackAnswer(
  question: string,
  latest: Observation | null,
  recent: Observation[],
  notes: ManualNote[],
): ChickAnswer {
  let lowerQuestion = question.toLowerCase()
  let concern = concernWords.some((word) => lowerQuestion.includes(word))
  let latestSummary = latest?.summary ?? 'No observations have been received yet.'
  let chickCount = latest?.stats.chick_count ?? latest?.detections.length ?? 0
  let heaterPct = Number(latest?.stats.heater_zone_pct_10m ?? 0)
  let movement = Number(latest?.stats.movement_score ?? 0)
  let alerts = latest?.alerts ?? []
  let safetyLevel: ChickAnswer['safety_level'] =
    concern || alerts.length > 0 ? 'adult_attention' : 'normal'

  if (latest && (heaterPct > 0.8 || movement < 0.05 || chickCount === 0)) {
    safetyLevel = 'adult_attention'
  }

  return {
    answer: latest
      ? `Based on the latest observation, ${latestSummary} The comfort signal is ${
          latest.comfort_score ?? 'unknown'
        } out of 5. This is an observation, not a health diagnosis, so an adult should directly check the brooder if anything seems concerning.`
      : 'I do not have a live observation yet. Start the webcam worker or add a manual observation, then I can explain what the stream is showing.',
    confidence: latest ? 'medium' : 'low',
    safety_level: safetyLevel,
    suggested_checks: [
      'Check the brooder thermometer directly.',
      'Confirm food and water are available and clean.',
      'Look for constant loud peeping, lethargy, wet bedding, or a chick separated from the group.',
    ],
    evidence: [
      latest ? `Latest summary: ${latestSummary}` : 'No latest observation is available.',
      `Recent observation count: ${recent.length}`,
      notes[0] ? `Latest manual note: ${notes[0].note}` : 'No manual notes are available.',
    ],
    follow_up_questions: [
      'What are they doing right now?',
      'What should we check before bedtime?',
    ],
  }
}

function toPromptObservation(observation: Observation | null) {
  if (!observation) return null
  return {
    timestamp: observation.observed_at,
    comfort_score: observation.comfort_score,
    summary: observation.summary,
    alerts: observation.alerts,
    heater_zone_pct_10m: observation.stats.heater_zone_pct_10m ?? 0,
    food_water_zone_pct_10m: observation.stats.food_water_zone_pct_10m ?? 0,
    movement_score: observation.stats.movement_score ?? 0,
  }
}

function normalizeAnswer(value: Partial<ChickAnswer>): ChickAnswer | null {
  if (!value || typeof value.answer !== 'string') return null
  return {
    answer: value.answer,
    confidence: value.confidence === 'high' || value.confidence === 'medium' ? value.confidence : 'low',
    safety_level:
      value.safety_level === 'adult_attention' || value.safety_level === 'check_now'
        ? value.safety_level
        : 'normal',
    suggested_checks: Array.isArray(value.suggested_checks) ? value.suggested_checks.map(String) : [],
    evidence: Array.isArray(value.evidence) ? value.evidence.map(String) : [],
    follow_up_questions: Array.isArray(value.follow_up_questions)
      ? value.follow_up_questions.map(String)
      : [],
  }
}

function parseJsonObject(content: string) {
  try {
    return JSON.parse(content)
  } catch {
    let start = content.indexOf('{')
    let end = content.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object in response')
    return JSON.parse(content.slice(start, end + 1))
  }
}
