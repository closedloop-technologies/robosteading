import assert from 'node:assert/strict'
import { test } from 'node:test'

import { addObservation, type ObservationAudio } from './store.ts'

test('addObservation strips non-finite audio metadata and raw upload flags', async () => {
  let observation = await addObservation({
    audio: {
      source: 'local_mic_frequency_filter',
      raw_audio_uploaded: true,
      human_voice_uploaded: true,
      window_seconds: Number.POSITIVE_INFINITY,
      sample_rate_hz: Number.NaN,
      filter_band_hz: [300, Number.NaN, Number.POSITIVE_INFINITY, '4200'],
      events: [
        {
          duration_ms: Number.POSITIVE_INFINITY,
          dominant_frequency_hz: Number.NaN,
          confidence: Number.POSITIVE_INFINITY,
        },
      ],
    } as unknown as ObservationAudio,
  })

  assert.equal(observation.audio?.raw_audio_uploaded, false)
  assert.equal(observation.audio?.human_voice_uploaded, false)
  assert.equal(observation.audio?.window_seconds, undefined)
  assert.equal(observation.audio?.sample_rate_hz, undefined)
  assert.deepEqual(observation.audio?.filter_band_hz, [300, 4200])
  assert.deepEqual(observation.audio?.events, [
    {
      timestamp: observation.audio?.events[0]?.timestamp,
      duration_ms: 0,
      dominant_frequency_hz: 0,
      peak_level_dbfs: 'unknown',
      confidence: 0,
    },
  ])
})
