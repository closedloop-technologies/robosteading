import assert from 'node:assert/strict'
import { test } from 'node:test'

import { addAudioSpectrumFrame, latestAudioSpectrumFrame } from './audio.server.ts'

test('addAudioSpectrumFrame rejects non-object payloads', () => {
  assert.throws(
    () => addAudioSpectrumFrame(null as unknown as Record<string, unknown>),
    /Audio frame payload must be an object/,
  )
  assert.throws(
    () => addAudioSpectrumFrame([] as unknown as Record<string, unknown>),
    /Audio frame payload must be an object/,
  )
})

test('addAudioSpectrumFrame derives bounded levels from bins when levels are omitted', () => {
  let frame = addAudioSpectrumFrame({
    bins: [
      [0.2, 1.4, -0.5],
      [0.1, 0.7],
    ],
    channels: 2,
    sample_rate: 44100,
  })

  assert.equal(frame.mode, 'stereo')
  assert.deepEqual(frame.bins, [
    [0.2, 1, 0],
    [0.1, 0.7],
  ])
  assert.deepEqual(frame.levels, [1, 0.7])
  assert.equal(latestAudioSpectrumFrame(frame.id - 1)?.id, frame.id)
  assert.equal(latestAudioSpectrumFrame(frame.id), null)
})

test('addAudioSpectrumFrame derives levels when clients send an empty level list', () => {
  let frame = addAudioSpectrumFrame({
    bins: [[0.15, 0.35]],
    levels: [],
  })

  assert.deepEqual(frame.levels, [0.35])
  assert.equal(frame.mode, 'mono')
})

test('addAudioSpectrumFrame preserves bounded client-provided levels', () => {
  let frame = addAudioSpectrumFrame({
    bins: [[0.1], [0.2]],
    levels: [1.5, -0.2, 0.8],
  })

  assert.deepEqual(frame.levels, [1, 0])
})

test('addAudioSpectrumFrame caps client-provided levels to bin channels', () => {
  let frame = addAudioSpectrumFrame({
    bins: [[0.1]],
    levels: [0.7, 0.9],
  })

  assert.deepEqual(frame.levels, [0.7])
  assert.equal(frame.mode, 'mono')
})

test('addAudioSpectrumFrame preserves clean client timestamps', () => {
  let frame = addAudioSpectrumFrame({
    bins: [[0.1]],
    timestamp: '2026-06-25T12:00:00.000Z',
  })

  assert.equal(frame.observed_at, '2026-06-25T12:00:00.000Z')
})

test('addAudioSpectrumFrame rejects malformed client timestamps', () => {
  assert.throws(
    () => addAudioSpectrumFrame({ bins: [[0.1]], timestamp: ' 2026-06-25T12:00:00.000Z' }),
    /Audio frame timestamp must be trimmed/,
  )
  assert.throws(
    () => addAudioSpectrumFrame({ bins: [[0.1]], timestamp: '2026-06-25T12:00:00.000Z\x7f' }),
    /Audio frame timestamp must not contain control characters/,
  )
  assert.throws(
    () => addAudioSpectrumFrame({ bins: [[0.1]], timestamp: '' }),
    /Audio frame timestamp must be a non-empty string/,
  )
  assert.throws(
    () => addAudioSpectrumFrame({ bins: [[0.1]], timestamp: 'not-a-date' }),
    /Audio frame timestamp must be a valid date/,
  )
})
