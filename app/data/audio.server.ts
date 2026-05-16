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

export function addAudioSpectrumFrame(input: Record<string, unknown>) {
  let bins = normalizeBins(input.bins)
  if (!bins.length) {
    throw new Error('Audio frame requires one or two non-empty bin arrays.')
  }

  let channels = Math.max(1, Math.min(2, Math.round(finiteNumber(input.channels, bins.length))))
  let frame: AudioSpectrumFrame = {
    id: nextAudioFrameId++,
    observed_at: typeof input.timestamp === 'string' ? input.timestamp : new Date().toISOString(),
    sample_rate: Math.max(1, Math.round(finiteNumber(input.sample_rate, 48000))),
    channels,
    mode: channels > 1 || bins.length > 1 ? 'stereo' : 'mono',
    bins,
    levels: Array.isArray(input.levels)
      ? input.levels.slice(0, 2).map((level) => Math.max(0, Math.min(1, finiteNumber(level, 0))))
      : bins.map((channel) => Math.max(0, ...channel)),
  }

  audioFrames = [frame, ...audioFrames].slice(0, 120)
  return frame
}

export function latestAudioSpectrumFrame(afterId = 0) {
  let latest = audioFrames[0] ?? null
  if (!latest || latest.id <= afterId) return null
  return latest
}
