const appBase = window.location.pathname.startsWith('/broodcast') ? '/broodcast' : ''
const latestUrl = `${appBase}/api/latest`
const chatUrl = `${appBase}/api/chat`

const liveImage = document.querySelector('#live-image')
const liveEmpty = document.querySelector('#live-empty')
const staleWarning = document.querySelector('#stale-warning')
const statsCards = document.querySelector('#stats-cards')
const chatForm = document.querySelector('#chat-form')
const chatAnswer = document.querySelector('#chat-answer')
const annotationLab = document.querySelector('#annotation-lab')
const liveStreamFrame = document.querySelector('#live-stream-frame')
const annotationCanvas = document.querySelector('#annotation-canvas')
const fullscreenStreamButton = document.querySelector('#fullscreen-stream-button')
const freezeFrameButton = document.querySelector('#freeze-frame-button')
const resumeStreamButton = document.querySelector('#resume-stream-button')
const freezeBadge = document.querySelector('#annotation-freeze-badge')
const partAnnotationForm = document.querySelector('#part-annotation-form')
const chickNameForm = document.querySelector('#chick-name-form')
const annotationList = document.querySelector('#annotation-list')
const chickNameList = document.querySelector('#chick-name-list')
const annotationAssist = document.querySelector('#annotation-assist')
const audioCanvas = document.querySelector('#audio-spectrogram')
const audioStartButton = document.querySelector('#audio-start-button')
const audioStopButton = document.querySelector('#audio-stop-button')
const audioChannelMode = document.querySelector('#audio-channel-mode')
const audioStatus = document.querySelector('#audio-status')
const audioMeterLeft = document.querySelector('#audio-meter-left')
const audioMeterRight = document.querySelector('#audio-meter-right')
const annotationsUrl = `${appBase}/api/annotations`
const annotationAssistUrl = `${appBase}/api/annotation-assist`
const chickNamesUrl = `${appBase}/api/chick-names`
const audioLatestUrl = `${appBase}/api/audio/latest`
const liveStatus = {
  lastUpdated: document.querySelector('[data-live-status="last-updated"]'),
  chicksDetected: document.querySelector('[data-live-status="chicks-detected"]'),
  comfortSignal: document.querySelector('[data-live-status="comfort-signal"]'),
  alerts: document.querySelector('[data-live-status="alerts"]'),
}
let latestRequestedAt = 0
let latestAppliedAt = 0
let currentObservation = null
let currentAnnotations = parseData(annotationLab?.dataset.annotations, [])
let currentChickNames = parseData(annotationLab?.dataset.chickIdentities, [])
let currentDetections = parseData(annotationLab?.dataset.detections, [])
let draftShape = null
let dragStart = null
let dragStartClient = null
let isFrameFrozen = false
let latestTimer = null
let audioPollTimer = null
let latestAudioFrameId = 0
let latestAudioFrameAt = 0

function metric(label, value) {
  return `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
}

function formatPercent(value) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'No data'
}

function formatNumber(value) {
  return typeof value === 'number' ? value.toFixed(2) : 'No data'
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function parseData(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

async function refreshLatest() {
  if (!statsCards) return

  const response = await fetch(latestUrl, { cache: 'no-store', headers: { accept: 'application/json' } })
  if (!response.ok) return
  const payload = await response.json()
  const observation = payload.observation

  if (!observation) return
  if (isFrameFrozen) return
  currentObservation = observation
  currentDetections = observation.detections || []
  renderChickOptions()
  const observedAt = Date.parse(observation.observed_at)
  if (!Number.isFinite(observedAt) || observedAt <= latestRequestedAt) return
  latestRequestedAt = observedAt

  if (observation.annotated_frame_url && liveImage) {
    const imageUrl = `${observation.annotated_frame_url}?observation=${encodeURIComponent(observation.id)}&t=${Date.now()}`
    const nextImage = new Image()
    nextImage.onload = () => {
      if (observedAt !== latestRequestedAt || observedAt <= latestAppliedAt) return
      latestAppliedAt = observedAt
      liveImage.src = imageUrl
      liveImage.classList.remove('hidden')
      if (liveEmpty) liveEmpty.classList.add('hidden')
      resizeAnnotationCanvas()
      drawAnnotations()
    }
    nextImage.src = imageUrl
  } else {
    latestAppliedAt = observedAt
  }

  const stats = observation.stats || {}
  const chickCount = stats.chick_count ?? observation.detections?.length ?? 0
  statsCards.innerHTML = [
    metric('Comfort signal', observation.comfort_score ? `${observation.comfort_score}/5` : 'No data'),
    metric('Chicks detected', chickCount),
    metric('Near heater', formatPercent(stats.heater_zone_pct_10m)),
    metric('Movement', formatNumber(stats.movement_score)),
  ].join('')
  if (liveStatus.lastUpdated) liveStatus.lastUpdated.textContent = new Date(observation.observed_at).toLocaleString()
  if (liveStatus.chicksDetected) liveStatus.chicksDetected.textContent = String(chickCount)
  if (liveStatus.comfortSignal) {
    liveStatus.comfortSignal.textContent = observation.comfort_score ? `${observation.comfort_score}/5` : 'unknown'
  }
  if (liveStatus.alerts) {
    liveStatus.alerts.textContent = observation.alerts?.length ? observation.alerts.join(', ') : 'none'
  }

  const ageMs = Date.now() - Date.parse(observation.observed_at)
  if (staleWarning) {
    if (ageMs > 10 * 60 * 1000) {
      staleWarning.textContent = `Stream may be stale. Last observation was ${Math.round(ageMs / 60000)} minutes ago.`
      staleWarning.classList.remove('hidden')
    } else {
      staleWarning.classList.add('hidden')
    }
  }
}

function freezeFrame() {
  if (isFrameFrozen || !currentObservation) return
  isFrameFrozen = true
  if (freezeBadge) freezeBadge.classList.remove('hidden')
  if (freezeFrameButton) freezeFrameButton.classList.add('hidden')
  if (resumeStreamButton) resumeStreamButton.classList.remove('hidden')
  if (annotationAssist) {
    annotationAssist.classList.remove('muted')
    annotationAssist.textContent = 'Frame frozen. Draw a box or click a point to annotate this exact image.'
  }
}

function resumeStream() {
  isFrameFrozen = false
  draftShape = null
  dragStart = null
  dragStartClient = null
  if (freezeBadge) freezeBadge.classList.add('hidden')
  if (freezeFrameButton) freezeFrameButton.classList.remove('hidden')
  if (resumeStreamButton) resumeStreamButton.classList.add('hidden')
  drawAnnotations()
  refreshLatest()
}

function isStreamFullscreen() {
  return document.fullscreenElement === liveStreamFrame
}

function updateFullscreenButton() {
  if (!fullscreenStreamButton) return
  const fullscreen = isStreamFullscreen()
  fullscreenStreamButton.textContent = fullscreen ? 'Exit' : 'Full screen'
  fullscreenStreamButton.setAttribute(
    'aria-label',
    fullscreen ? 'Exit full screen stream' : 'Show stream full screen',
  )
}

async function toggleStreamFullscreen() {
  if (!liveStreamFrame || !document.fullscreenEnabled) return

  try {
    if (isStreamFullscreen()) {
      await document.exitFullscreen()
    } else {
      await liveStreamFrame.requestFullscreen()
    }
  } catch {
    updateFullscreenButton()
  }
}

async function refreshAnnotations() {
  if (!annotationLab) return
  const response = await fetch(annotationsUrl, { cache: 'no-store', headers: { accept: 'application/json' } })
  if (!response.ok) return
  const payload = await response.json()
  currentAnnotations = payload.annotations || []
  currentChickNames = payload.chick_identities || []
  renderAnnotationLists()
  drawAnnotations()
}

function renderAnswer(answer) {
  const list = (items) => `<ul>${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
  chatAnswer.classList.remove('muted')
  chatAnswer.innerHTML = `
    <h4>Answer</h4>
    <p>${escapeHtml(answer.answer)}</p>
    <h4>Evidence</h4>
    ${list(answer.evidence)}
    <h4>Suggested checks</h4>
    ${list(answer.suggested_checks)}
    <h4>Safety level</h4>
    <p>${escapeHtml(answer.safety_level)}</p>
  `
}

function resizeAudioCanvas() {
  if (!audioCanvas) return
  const rect = audioCanvas.getBoundingClientRect()
  const scale = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round(rect.width * scale))
  const height = Math.max(1, Math.round(rect.height * scale))
  if (audioCanvas.width === width && audioCanvas.height === height) return
  audioCanvas.width = width
  audioCanvas.height = height
  const ctx = audioCanvas.getContext('2d')
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, audioCanvas.width, audioCanvas.height)
}

function audioColor(intensity) {
  const value = Math.max(0, Math.min(1, intensity))
  const r = Math.round(20 + value * 235)
  const g = Math.round(32 + Math.max(0, value - 0.2) * 210)
  const b = Math.round(55 + (1 - value) * 90)
  return `rgb(${r}, ${g}, ${b})`
}

function drawSpectrogramColumn(ctx, bins, channelIndex, channelCount) {
  const channelHeight = Math.floor(audioCanvas.height / channelCount)
  const top = channelIndex * channelHeight
  const height = channelIndex === channelCount - 1 ? audioCanvas.height - top : channelHeight
  const x = audioCanvas.width - 1

  for (let y = 0; y < height; y += 1) {
    const bin = Math.floor(((height - y - 1) / Math.max(1, height - 1)) * (bins.length - 1))
    const intensity = Math.pow(bins[bin] || 0, 1.35)
    ctx.fillStyle = audioColor(intensity)
    ctx.fillRect(x, top + y, 1, 1)
  }
}

function drawAudioSpectrumFrame(frame) {
  if (!audioCanvas || !frame?.bins?.length) return
  resizeAudioCanvas()
  const ctx = audioCanvas.getContext('2d')
  ctx.drawImage(audioCanvas, 1, 0, audioCanvas.width - 1, audioCanvas.height, 0, 0, audioCanvas.width - 1, audioCanvas.height)
  ctx.fillStyle = '#111827'
  ctx.fillRect(audioCanvas.width - 1, 0, 1, audioCanvas.height)

  const requestedMode = audioChannelMode?.value === 'stereo' ? 'stereo' : 'mono'
  const sourceBins = frame.bins || []
  const channelCount = requestedMode === 'stereo' && sourceBins.length > 1 ? 2 : 1
  const bins =
    channelCount === 1
      ? [sourceBins[0].map((value, index) => {
          let right = sourceBins[1]?.[index]
          return typeof right === 'number' ? (value + right) / 2 : value
        })]
      : sourceBins.slice(0, 2)

  for (let index = 0; index < channelCount; index += 1) {
    drawSpectrogramColumn(ctx, bins[index], index, channelCount)
  }

  if (channelCount === 2) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.fillRect(0, Math.floor(audioCanvas.height / 2), audioCanvas.width, 1)
  }

  if (audioMeterLeft) audioMeterLeft.value = frame.levels?.[0] ?? Math.max(0, ...bins[0])
  if (audioMeterRight) audioMeterRight.value = frame.levels?.[1] ?? frame.levels?.[0] ?? Math.max(0, ...(bins[1] || bins[0]))
}

async function startAudioSpectrogram() {
  if (!audioCanvas) return
  audioStartButton.classList.add('hidden')
  audioStopButton?.classList.remove('hidden')
  if (audioStatus) audioStatus.textContent = 'Listening for Python audio spectrum frames...'
  await pollAudioSpectrum()
  audioPollTimer = window.setInterval(pollAudioSpectrum, 120)
}

function stopAudioSpectrogram() {
  if (audioPollTimer) window.clearInterval(audioPollTimer)
  audioPollTimer = null
  if (audioMeterLeft) audioMeterLeft.value = 0
  if (audioMeterRight) audioMeterRight.value = 0
  if (audioStatus) audioStatus.textContent = 'Audio stream stopped.'
  audioStartButton?.classList.remove('hidden')
  audioStopButton?.classList.add('hidden')
}

async function pollAudioSpectrum() {
  if (!audioCanvas) return
  try {
    const response = await fetch(`${audioLatestUrl}?after=${latestAudioFrameId}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    if (!payload.frame) {
      if (audioStatus && Date.now() - latestAudioFrameAt > 3000) {
        audioStatus.textContent = 'Waiting for Python audio spectrum frames.'
      }
      return
    }

    latestAudioFrameId = payload.frame.id
    latestAudioFrameAt = Date.now()
    drawAudioSpectrumFrame(payload.frame)
    if (audioStatus) {
      const channels = payload.frame.channels === 2 ? 'stereo' : 'mono'
      const sampleRate = payload.frame.sample_rate ? `${Math.round(payload.frame.sample_rate / 1000)} kHz` : 'unknown rate'
      audioStatus.textContent = `Python stream connected: ${channels}, ${sampleRate}.`
    }
  } catch (error) {
    if (audioStatus) audioStatus.textContent = `Audio stream error: ${error?.message || 'connection failed'}.`
  }
}

if (chatForm && chatAnswer) {
  for (const button of document.querySelectorAll('[data-prompt]')) {
    button.addEventListener('click', () => {
      chatForm.elements.message.value = button.dataset.prompt
      chatForm.elements.message.focus()
    })
  }

  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const message = chatForm.elements.message.value.trim()
    if (!message) return

    chatAnswer.textContent = 'Thinking...'
    chatAnswer.classList.add('muted')
    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ session_id: 'public-browser', message }),
    })
    const payload = await response.json()
    if (!response.ok) {
      chatAnswer.textContent = payload.error || 'Chat failed.'
      return
    }
    renderAnswer(payload)
  })
}

function imageMetrics() {
  if (!liveImage || !annotationCanvas || !liveImage.naturalWidth || !liveImage.naturalHeight) return null
  const canvasRect = annotationCanvas.getBoundingClientRect()
  const imageRatio = liveImage.naturalWidth / liveImage.naturalHeight
  const canvasRatio = canvasRect.width / canvasRect.height
  let width = canvasRect.width
  let height = canvasRect.height
  let left = 0
  let top = 0
  if (canvasRatio > imageRatio) {
    width = height * imageRatio
    left = (canvasRect.width - width) / 2
  } else {
    height = width / imageRatio
    top = (canvasRect.height - height) / 2
  }
  return { canvasRect, left, top, width, height, naturalWidth: liveImage.naturalWidth, naturalHeight: liveImage.naturalHeight }
}

function canvasPoint(event) {
  const metrics = imageMetrics()
  if (!metrics) return null
  const x = event.clientX - metrics.canvasRect.left - metrics.left
  const y = event.clientY - metrics.canvasRect.top - metrics.top
  if (x < 0 || y < 0 || x > metrics.width || y > metrics.height) return null
  return [
    Math.round((x / metrics.width) * metrics.naturalWidth),
    Math.round((y / metrics.height) * metrics.naturalHeight),
  ]
}

function toCanvasBox(box, metrics) {
  const [x1, y1, x2, y2] = box
  return [
    metrics.left + (x1 / metrics.naturalWidth) * metrics.width,
    metrics.top + (y1 / metrics.naturalHeight) * metrics.height,
    metrics.left + (x2 / metrics.naturalWidth) * metrics.width,
    metrics.top + (y2 / metrics.naturalHeight) * metrics.height,
  ]
}

function readableChickBox(box) {
  let [x1, y1, x2, y2] = box
  const minSize = 22
  const width = x2 - x1
  const height = y2 - y1
  if (width < minSize) {
    const pad = (minSize - width) / 2
    x1 -= pad
    x2 += pad
  }
  if (height < minSize) {
    const pad = (minSize - height) / 2
    y1 -= pad
    y2 += pad
  }
  return [x1, y1, x2, y2]
}

function resizeAnnotationCanvas() {
  if (!annotationCanvas) return
  const rect = annotationCanvas.getBoundingClientRect()
  annotationCanvas.width = Math.max(1, Math.round(rect.width))
  annotationCanvas.height = Math.max(1, Math.round(rect.height))
}

function drawAnnotations() {
  if (!annotationCanvas) return
  resizeAnnotationCanvas()
  const ctx = annotationCanvas.getContext('2d')
  const metrics = imageMetrics()
  ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height)
  if (!metrics) return
  ctx.font = '700 13px Inter, sans-serif'

  ctx.lineWidth = 2
  for (const annotation of currentAnnotations.slice(0, 80)) {
    ctx.strokeStyle = annotation.color || '#f59e0b'
    ctx.fillStyle = annotation.color || '#f59e0b'
    if (annotation.kind === 'box' && annotation.box) {
      const [x1, y1, x2, y2] = toCanvasBox(annotation.box, metrics)
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
      ctx.fillText(annotation.label, x1 + 4, Math.max(14, y1 - 4))
    }
    if (annotation.kind === 'point' && annotation.point) {
      const [x, y] = toCanvasBox([...annotation.point, ...annotation.point], metrics)
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillText(annotation.label, x + 8, y - 8)
    }
  }

  const chickDetections = currentDetections.filter((detection) => {
    const className = String(detection.class_name || 'chick').toLowerCase()
    return detection.bbox && (className === 'chick' || detection.track_id?.startsWith('chick_'))
  })

  for (const detection of chickDetections) {
    const name = currentChickNames.find((identity) => identity.track_id === detection.track_id)?.name
    const [x1, y1, x2, y2] = readableChickBox(toCanvasBox(detection.bbox, metrics))
    const label = name || detection.track_id
    const labelWidth = ctx.measureText(label).width + 10
    const labelX = Math.max(metrics.left + 2, Math.min(x1, metrics.left + metrics.width - labelWidth - 2))
    const labelY = Math.max(metrics.top + 18, y1 - 8)

    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 7
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 4
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
    ctx.fillStyle = 'rgba(250, 204, 21, 0.12)'
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1)

    ctx.fillStyle = 'rgba(17, 24, 39, 0.92)'
    ctx.fillRect(labelX, labelY - 15, labelWidth, 18)
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 2
    ctx.strokeRect(labelX, labelY - 15, labelWidth, 18)
    ctx.fillStyle = '#fef3c7'
    ctx.fillText(label, labelX + 5, labelY - 2)

    const centerX = x1 + (x2 - x1) / 2
    const centerY = y1 + (y2 - y1) / 2
    ctx.fillStyle = '#111827'
    ctx.beginPath()
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  if (draftShape?.kind === 'box') {
    const [x1, y1, x2, y2] = toCanvasBox(draftShape.box, metrics)
    ctx.strokeStyle = '#f59e0b'
    ctx.setLineDash([6, 4])
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
    ctx.setLineDash([])
  }
}

function renderAssist(payload) {
  if (!annotationAssist) return
  const provider = payload.provider === 'kimi' ? 'Kimi/BAML' : 'Local fallback'
  const suggestions = (payload.suggestions || [])
    .map((suggestion) => `<button type="button" data-assist-label="${escapeHtml(suggestion.label)}">${escapeHtml(suggestion.label)}</button>`)
    .join('')
  const checks = (payload.quality_checks || []).map((check) => `<li>${escapeHtml(check)}</li>`).join('')
  annotationAssist.classList.remove('muted')
  annotationAssist.innerHTML = `
    <p><strong>${provider}:</strong> ${escapeHtml(payload.guidance || 'No guidance returned.')}</p>
    <div class="assist-suggestions">${suggestions}</div>
    ${checks ? `<ul>${checks}</ul>` : ''}
  `
}

async function requestAnnotationAssist() {
  if (!annotationAssist || !currentObservation) return
  annotationAssist.classList.remove('muted')
  annotationAssist.textContent = 'Asking Kimi through BAML...'
  const response = await fetch(annotationAssistUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      observation_id: currentObservation.id,
      detections: currentDetections,
      draft: {
        label: partAnnotationForm?.elements.label.value.trim() || null,
        kind: draftShape?.kind || partAnnotationForm?.elements.kind.value || 'box',
        box: draftShape?.box || null,
        point: draftShape?.point || null,
        image_size: liveImage?.naturalWidth ? [liveImage.naturalWidth, liveImage.naturalHeight] : null,
      },
    }),
  })
  const payload = await response.json()
  if (!response.ok) {
    annotationAssist.textContent = payload.error || 'Annotation assist failed.'
    return
  }
  renderAssist(payload)
}

function renderAnnotationLists() {
  if (annotationList) {
    annotationList.innerHTML = currentAnnotations
      .slice(0, 12)
      .map((annotation) => `<span>${escapeHtml(annotation.label)}</span>`)
      .join('')
  }
  if (chickNameList) {
    chickNameList.innerHTML = currentChickNames
      .slice(0, 12)
      .map((identity) => `<span>${escapeHtml(identity.track_id)}: ${escapeHtml(identity.name)}</span>`)
      .join('')
  }
}

function renderChickOptions() {
  if (!chickNameForm) return
  const select = chickNameForm.elements.track_id
  const currentValue = select.value
  select.innerHTML = currentDetections
    .map((detection) => {
      const label = `${detection.track_id} · ${detection.zone}`
      return `<option value="${escapeHtml(detection.track_id)}">${escapeHtml(label)}</option>`
    })
    .join('')
  if ([...select.options].some((option) => option.value === currentValue)) {
    select.value = currentValue
  }
}

if (annotationCanvas && partAnnotationForm) {
  annotationCanvas.addEventListener('pointerdown', (event) => {
    freezeFrame()
    dragStart = canvasPoint(event)
    dragStartClient = [event.clientX, event.clientY]
    draftShape = null
  })

  annotationCanvas.addEventListener('pointermove', (event) => {
    if (!dragStart || partAnnotationForm.elements.kind.value !== 'box') return
    const current = canvasPoint(event)
    if (!current) return
    draftShape = {
      kind: 'box',
      box: [
        Math.min(dragStart[0], current[0]),
        Math.min(dragStart[1], current[1]),
        Math.max(dragStart[0], current[0]),
        Math.max(dragStart[1], current[1]),
      ],
    }
    drawAnnotations()
  })

  annotationCanvas.addEventListener('pointerup', (event) => {
    const end = canvasPoint(event)
    if (!dragStart || !end) return
    const dragDistance = dragStartClient
      ? Math.hypot(event.clientX - dragStartClient[0], event.clientY - dragStartClient[1])
      : 0
    if (partAnnotationForm.elements.kind.value === 'point' || dragDistance < 6) {
      draftShape = { kind: 'point', point: end }
    } else {
      draftShape = {
        kind: 'box',
        box: [
          Math.min(dragStart[0], end[0]),
          Math.min(dragStart[1], end[1]),
          Math.max(dragStart[0], end[0]),
          Math.max(dragStart[1], end[1]),
        ],
      }
    }
    dragStart = null
    dragStartClient = null
    drawAnnotations()
    requestAnnotationAssist()
  })

  partAnnotationForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!draftShape) return
    const label = partAnnotationForm.elements.label.value.trim()
    if (!label) return
    const payload = {
      label,
      kind: draftShape.kind,
      box: draftShape.box,
      point: draftShape.point,
      observation_id: currentObservation?.id || annotationLab?.dataset.observationId || null,
      frame_id: currentObservation?.frame_id || annotationLab?.dataset.frameId || null,
      image_size: liveImage?.naturalWidth ? [liveImage.naturalWidth, liveImage.naturalHeight] : null,
    }
    const response = await fetch(annotationsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      draftShape = null
      partAnnotationForm.reset()
      await refreshAnnotations()
    }
  })
}

if (annotationAssist && partAnnotationForm) {
  annotationAssist.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    const label = target.dataset.assistLabel
    if (!label) return
    partAnnotationForm.elements.label.value = label
  })
}

if (freezeFrameButton) freezeFrameButton.addEventListener('click', freezeFrame)
if (resumeStreamButton) resumeStreamButton.addEventListener('click', resumeStream)
if (fullscreenStreamButton) {
  if (liveStreamFrame && document.fullscreenEnabled) {
    fullscreenStreamButton.addEventListener('click', toggleStreamFullscreen)
  } else {
    fullscreenStreamButton.disabled = true
  }
}
if (audioStartButton) audioStartButton.addEventListener('click', startAudioSpectrogram)
if (audioStopButton) audioStopButton.addEventListener('click', stopAudioSpectrogram)
if (audioChannelMode) {
  audioChannelMode.addEventListener('change', () => {
    resizeAudioCanvas()
  })
}

if (chickNameForm) {
  chickNameForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const trackId = chickNameForm.elements.track_id.value
    const detection = currentDetections.find((item) => item.track_id === trackId)
    const name = chickNameForm.elements.name.value.trim()
    if (!trackId || !name) return
    const response = await fetch(chickNamesUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        track_id: trackId,
        name,
        observation_id: currentObservation?.id || null,
        example_bbox: detection?.bbox || null,
      }),
    })
    if (response.ok) {
      chickNameForm.reset()
      await refreshAnnotations()
    }
  })
}

window.addEventListener('resize', () => {
  drawAnnotations()
  resizeAudioCanvas()
})
document.addEventListener('fullscreenchange', () => {
  updateFullscreenButton()
  window.requestAnimationFrame(drawAnnotations)
})
updateFullscreenButton()
renderAnnotationLists()
renderChickOptions()
resizeAudioCanvas()
refreshAnnotations()
refreshLatest()
latestTimer = setInterval(refreshLatest, 1000)
