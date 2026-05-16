class ChickObservation {
  timestamp string
  comfort_score int
  summary string
  alerts string[]
  heater_zone_pct_10m float
  food_water_zone_pct_10m float
  movement_score float
}

class ChickAnswer {
  answer string
  confidence "low" | "medium" | "high"
  safety_level "normal" | "check_now" | "adult_attention"
  suggested_checks string[]
  evidence string[]
  follow_up_questions string[]
}

function AnswerChickQuestion(
  question: string,
  latest_observation: ChickObservation,
  recent_observations: ChickObservation[],
  manual_notes: string[],
  knowledge_snippets: string[]
) -> ChickAnswer {
  client Kimi
  prompt #"
    You are BroodCast, a cautious educational assistant for a temporary chick brooder.

    Your job:
    - Answer questions about the chicks using the latest observations.
    - Explain chick behavior in simple language.
    - Recommend human checks when appropriate.
    - Never claim to diagnose illness.
    - Never say the system replaces adult supervision.
    - Never tell users to change heat, food, water, or housing without checking conditions directly.
    - If the question involves danger, distress, injury, lethargy, overheating, dehydration, constant loud peeping, or a chick being trapped, set safety_level to adult_attention.

    Latest observation:
    {{ latest_observation }}

    Recent observations:
    {{ recent_observations }}

    Manual notes:
    {{ manual_notes }}

    Chick care knowledge:
    {{ knowledge_snippets }}

    User question:
    {{ question }}
  "#
}

class ChickDetection {
  track_id string
  class_name string
  bbox int[]
  confidence float
  zone string
  activity string
}

class BrooderAnnotation {
  label string
  kind "box" | "corners" | "point"
  bounding_box int[]?
  corners int[][]?
  point int[]?
  frame_id string?
  created_by string
}

class ChickIdentity {
  track_id string
  name string
}

class DraftAnnotation {
  label string?
  kind "box" | "corners" | "point"
  bounding_box int[]?
  corners int[][]?
  point int[]?
  image_size int[]?
}

class AnnotationSuggestion {
  label "chick" | "heater" | "water" | "food" | "waste" | "bedding"
  kind "box" | "corners" | "point"
  reason string
}

class AnnotationAssistResult {
  guidance string
  suggestions AnnotationSuggestion[]
  quality_checks string[]
}

function AssistBrooderAnnotation(
  latest_observation: ChickObservation,
  detections: ChickDetection[],
  existing_annotations: BrooderAnnotation[],
  chick_identities: ChickIdentity[],
  draft: DraftAnnotation
) -> AnnotationAssistResult {
  client Kimi
  prompt #"
    You are helping kids and adults annotate a chick brooder frame.

    Return concise structured guidance for the current annotation action.

    Rules:
    - Allowed labels are chick, heater, water, food, waste, bedding.
    - Prefer four-corner annotations for visible objects; use box only for legacy axis-aligned rectangles.
    - Use chick only when the annotation covers a visible chick body.
    - Do not label poop, feed, bedding, shadows, stains, or dark specks as chick.
    - Prefer waste for poop/droppings.
    - Prefer food for feed, spilled feed, or the feeder.
    - Prefer water for the drinker or water line.
    - Prefer heater for the warm/heater area or heater hardware.
    - Prefer bedding for liner, shavings, turf, paper towel, or brooder floor material.
    - Do not claim you can inspect pixels directly. Use the observation, model detections, draft geometry, and existing human labels.
    - If detections are empty or low confidence, tell the user to label obvious objects manually.
    - Keep guidance short enough for a live annotation panel.

    Latest observation:
    {{ latest_observation }}

    Current model detections:
    {{ detections }}

    Existing human labels:
    {{ existing_annotations }}

    Known chick names:
    {{ chick_identities }}

    Current draft annotation:
    {{ draft }}
  "#
}
