const appBase = window.location.pathname.startsWith('/chickcheck') ? '/chickcheck' : ''
const latestUrl = `${appBase}/api/latest`
const chatUrl = `${appBase}/api/chat`

const liveImage = document.querySelector('#live-image')
const liveEmpty = document.querySelector('#live-empty')
const staleWarning = document.querySelector('#stale-warning')
const statsCards = document.querySelector('#stats-cards')
const chatForm = document.querySelector('#chat-form')
const chatAnswer = document.querySelector('#chat-answer')

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

async function refreshLatest() {
  if (!statsCards) return

  const response = await fetch(latestUrl, { headers: { accept: 'application/json' } })
  if (!response.ok) return
  const payload = await response.json()
  const observation = payload.observation

  if (!observation) return

  if (observation.annotated_frame_url && liveImage) {
    liveImage.src = `${observation.annotated_frame_url}?t=${encodeURIComponent(observation.observed_at)}`
    liveImage.classList.remove('hidden')
    if (liveEmpty) liveEmpty.classList.add('hidden')
  }

  const stats = observation.stats || {}
  statsCards.innerHTML = [
    metric('Comfort signal', observation.comfort_score ? `${observation.comfort_score}/5` : 'No data'),
    metric('Chicks detected', stats.chick_count ?? observation.detections?.length ?? 0),
    metric('Near heater', formatPercent(stats.heater_zone_pct_10m)),
    metric('Movement', formatNumber(stats.movement_score)),
  ].join('')

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

refreshLatest()
setInterval(refreshLatest, 4000)
