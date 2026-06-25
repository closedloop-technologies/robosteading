export type AudioSpectrumFrame = {
  id: number
  observed_at: string
  sample_rate: number
  channels: number
  mode: 'mono' | 'stereo'
  bins: number[][]
  levels: number[]
}

let nextAudioFrameId = 1
let audioFrames: AudioSpectrumFrame[] = []

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeBins(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 2)
    .map((channel) =>
      Array.isArray(channel)
        ? channel
            .slice(0, 512)
            .map((bin) => Math.max(0, Math.min(1, finiteNumber(bin, 0))))
        : [],
    )
    .filter((channel) => channel.length > 0)
}

function normalizeLevels(value: unknown, bins: number[][]) {
  let levels = Array.isArray(value)
    ? value.slice(0, 2).map((level) => Math.max(0, Math.min(1, finiteNumber(level, 0))))
    : []
  if (levels.length > 0) return levels

  return bins.map((channel) => Math.max(0, ...channel)).slice(0, 2)
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== 'string') return new Date().toISOString()
  if (!value.trim()) throw new Error('Audio frame timestamp must be a non-empty string.')
  if (value !== value.trim()) throw new Error('Audio frame timestamp must be trimmed.')
  if ([...value].some((character) => {
    let codePoint = character.codePointAt(0)
    return codePoint !== undefined && (codePoint < 32 || codePoint === 127)
  })) {
    throw new Error('Audio frame timestamp must not contain control characters.')
  }
  return value
}

export function addAudioSpectrumFrame(input: Record<string, unknown>) {
  let bins = normalizeBins(input.bins)
  if (!bins.length) {
    throw new Error('Audio frame requires one or two non-empty bin arrays.')
  }

  let channels = Math.max(1, Math.min(2, Math.round(finiteNumber(input.channels, bins.length))))
  let frame: AudioSpectrumFrame = {
    id: nextAudioFrameId++,
    observed_at: normalizeTimestamp(input.timestamp),
    sample_rate: Math.max(1, Math.round(finiteNumber(input.sample_rate, 48000))),
    channels,
    mode: channels > 1 || bins.length > 1 ? 'stereo' : 'mono',
    bins,
    levels: normalizeLevels(input.levels, bins),
  }

  audioFrames = [frame, ...audioFrames].slice(0, 120)
  return frame
}

export function latestAudioSpectrumFrame(afterId = 0) {
  let latest = audioFrames[0] ?? null
  if (!latest || latest.id <= afterId) return null
  return latest
}
