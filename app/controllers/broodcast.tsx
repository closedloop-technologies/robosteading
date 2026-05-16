import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { adminCookie, clearAdminCookie, adminToken, isAdminRequest } from '../data/auth.ts'
import { assistAnnotation } from '../data/annotation-assist.server.ts'
import { addAudioSpectrumFrame, latestAudioSpectrumFrame } from '../data/audio.server.ts'
import { answerChickQuestion } from '../data/chat.server.ts'
import {
  addAnnotation,
  addManualNote,
  addObservation,
  allObservations,
  getZones,
  isPublicVisible,
  latestObservation,
  listAnnotations,
  listChickIdentities,
  listManualNotes,
  listObservations,
  replaceZones,
  setPublicVisible,
  upsertChickIdentity,
  type ChickIdentity,
  type BrooderAnnotation,
  type Detection,
  type Observation,
} from '../data/store.ts'
import { PageShell, SafetyBanner, StatusLine } from '../ui/layout.tsx'
import { json, readJson, redirect } from '../utils/http.ts'
import { render } from '../utils/render.tsx'

export const live = {
  async handler({ request }: { request: Request }) {
    let latest = await latestObservation()
    let recent = await listObservations(30)
    let visible = await isPublicVisible()
    let annotations = await listAnnotations()
    let chickIdentities = await listChickIdentities()
    return render(
      <PageShell title="BroodCast" description="A window into the secret life of chicks.">
        <LivePage
          latest={latest}
          recent={recent}
          visible={visible}
          annotations={annotations}
          chickIdentities={chickIdentities}
        />
      </PageShell>,
      request,
    )
  },
}

export const dashboard = {
  async handler({ request }: { request: Request }) {
    if (!isAdminRequest(request)) return redirect('/broodcast/login?next=/broodcast/dashboard')
    let latest = await latestObservation()
    let recent = await listObservations(120)
    let notes = await listManualNotes({ includePrivate: true })
    let zones = await getZones()
    let visible = await isPublicVisible()
    return render(
      <PageShell title="BroodCast Dashboard" description="Admin dashboard for BroodCast.">
        <DashboardPage
          latest={latest}
          recent={recent}
          notes={notes}
          zones={zones}
          visible={visible}
        />
      </PageShell>,
      request,
    )
  },
}

export const login = {
  async handler({ request, url }: { request: Request; url: URL }) {
    let failed = url.searchParams.get('error') === '1'
    return render(
      <PageShell title="BroodCast Login" description="Admin access for the BroodCast stream.">
        <section className="cc-section narrow">
          <h1>BroodCast Login</h1>
          <p className="muted">Use the temporary weekend admin token.</p>
          {failed ? <p className="form-error">That token did not match.</p> : null}
          <form className="stack-form" method="post" action="/broodcast/login">
            <input type="hidden" name="next" value={url.searchParams.get('next') ?? '/broodcast/dashboard'} />
            <label>
              Admin token
              <input name="token" type="password" autoComplete="current-password" required />
            </label>
            <button className="btn btn-primary" type="submit">
              Sign in
            </button>
          </form>
        </section>
      </PageShell>,
      request,
    )
  },
}

export const loginAction = {
  async handler({ request }: { request: Request }) {
    let form = await request.formData()
    let token = String(form.get('token') ?? '')
    let next = String(form.get('next') ?? '/broodcast/dashboard')
    if (token !== adminToken()) return redirect('/broodcast/login?error=1')
    return redirect(next.startsWith('/') ? next : '/broodcast/dashboard', 303, { 'Set-Cookie': adminCookie() })
  },
}

export const logout = {
  async handler() {
    return redirect('/broodcast/live', 303, { 'Set-Cookie': clearAdminCookie() })
  },
}

export const report = {
  async handler({ request }: { request: Request }) {
    let observations = await allObservations()
    let notes = await listManualNotes({ includePrivate: isAdminRequest(request) })
    return render(
      <PageShell title="BroodCast Report" description="Weekend chick care report.">
        <ReportPage observations={observations} notes={notes} />
      </PageShell>,
      request,
    )
  },
}

export const apiLatest = {
  async handler() {
    return json({ observation: await latestObservation(), public_visible: await isPublicVisible() })
  },
}

export const apiObservations = {
  async handler({ url }: { url: URL }) {
    let minutes = Number(url.searchParams.get('minutes') ?? '30')
    return json({ observations: await listObservations(Number.isFinite(minutes) ? minutes : 30) })
  },
}

export const apiLatestAudioSpectrum = {
  async handler({ url }: { url: URL }) {
    let after = Number(url.searchParams.get('after') ?? '0')
    return json({ frame: latestAudioSpectrumFrame(Number.isFinite(after) ? after : 0) })
  },
}

export const apiIngestAudioSpectrum = {
  async handler({ request }: { request: Request }) {
    let expected = process.env.STREAM_INGEST_TOKEN ?? 'dev-stream-token'
    let auth = request.headers.get('authorization') ?? ''
    let token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-stream-token')
    if (token !== expected) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    let body = await readJson(request)
    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'Expected JSON body.' }, { status: 400 })
    }

    try {
      let frame = addAudioSpectrumFrame(body as Record<string, unknown>)
      return json({ ok: true, frame_id: frame.id })
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : 'Invalid audio frame.' }, { status: 400 })
    }
  },
}

export const apiIngestObservation = {
  async handler({ request }: { request: Request }) {
    let expected = process.env.STREAM_INGEST_TOKEN ?? 'dev-stream-token'
    let auth = request.headers.get('authorization') ?? ''
    let token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-stream-token')
    if (token !== expected) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    let body = await readJson(request)
    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'Expected JSON body.' }, { status: 400 })
    }

    let input = body as Record<string, unknown>
    let frameUrl = typeof input.annotated_frame_url === 'string' ? input.annotated_frame_url : null
    if (typeof input.annotated_frame_base64 === 'string') {
      frameUrl = await saveBase64Frame(input.annotated_frame_base64, input.frame_id)
    }

    let observation = await addObservation({
      ...input,
      annotated_frame_url: frameUrl,
    })
    return json({ ok: true, observation_id: observation.id })
  },
}

export const apiChat = {
  async handler({ request }: { request: Request }) {
    let body = await readJson(request)
    let message =
      body && typeof body === 'object' && typeof (body as Record<string, unknown>).message === 'string'
        ? String((body as Record<string, unknown>).message)
        : ''
    if (!message.trim()) return json({ error: 'Message is required.' }, { status: 400 })

    let answer = await answerChickQuestion(
      message,
      await latestObservation(),
      await listObservations(60),
      await listManualNotes({ includePrivate: isAdminRequest(request) }),
    )
    return json(answer)
  },
}

export const apiAnnotations = {
  async handler({ request }: { request: Request }) {
    if (request.method === 'GET') {
      return json({
        annotations: await listAnnotations(),
        chick_identities: await listChickIdentities(),
      })
    }

    let body = await readJson(request)
    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'Expected JSON body.' }, { status: 400 })
    }

    let input = body as Record<string, unknown>
    let label = String(input.label ?? '').trim()
    let kind: 'box' | 'point' = input.kind === 'point' ? 'point' : 'box'
    let box = Array.isArray(input.box) ? input.box.map(Number).slice(0, 4) : null
    let point = Array.isArray(input.point) ? input.point.map(Number).slice(0, 2) : null
    let imageSize = Array.isArray(input.image_size) ? input.image_size.map(Number).slice(0, 2) : null

    if (!label) return json({ ok: false, error: 'Label is required.' }, { status: 400 })
    if (kind === 'box' && (!box || box.length !== 4)) {
      return json({ ok: false, error: 'Box annotations need four coordinates.' }, { status: 400 })
    }
    if (kind === 'point' && (!point || point.length !== 2)) {
      return json({ ok: false, error: 'Point annotations need two coordinates.' }, { status: 400 })
    }

    let annotation = await addAnnotation({
      label,
      kind,
      color: typeof input.color === 'string' ? input.color : undefined,
      observation_id: typeof input.observation_id === 'string' ? input.observation_id : null,
      frame_id: typeof input.frame_id === 'string' ? input.frame_id : null,
      box,
      point,
      image_size: imageSize,
      created_by: typeof input.created_by === 'string' ? input.created_by : 'kid',
    })
    return json({ ok: true, annotation })
  },
}

export const apiAnnotationAssist = {
  async handler({ request }: { request: Request }) {
    let body = await readJson(request)
    let input = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    let observationId = typeof input.observation_id === 'string' ? input.observation_id : null
    let latest = await latestObservation()
    let recent = await listObservations(60)
    let observation = recent.find((item) => item.id === observationId) ?? latest
    let detections = Array.isArray(input.detections) ? (input.detections as Detection[]) : observation?.detections ?? []
    let draft = input.draft && typeof input.draft === 'object' ? (input.draft as any) : null

    let result = await assistAnnotation({
      observation,
      detections,
      annotations: await listAnnotations(),
      chickIdentities: await listChickIdentities(),
      draft,
    })

    return json({ ok: true, ...result })
  },
}

export const apiChickNames = {
  async handler({ request }: { request: Request }) {
    let body = await readJson(request)
    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'Expected JSON body.' }, { status: 400 })
    }

    let input = body as Record<string, unknown>
    let trackId = String(input.track_id ?? '').trim()
    let name = String(input.name ?? '').trim()
    let exampleBbox = Array.isArray(input.example_bbox) ? input.example_bbox.map(Number).slice(0, 4) : null
    if (!trackId || !name) return json({ ok: false, error: 'Track and name are required.' }, { status: 400 })

    let identity = await upsertChickIdentity({
      track_id: trackId,
      name,
      observation_id: typeof input.observation_id === 'string' ? input.observation_id : null,
      example_bbox: exampleBbox,
    })
    return json({ ok: true, identity })
  },
}

export const apiManualNotes = {
  async handler({ request }: { request: Request }) {
    if (!isAdminRequest(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    let contentType = request.headers.get('content-type') ?? ''
    let note = ''
    let visibility: 'private' | 'public' = 'private'

    if (contentType.includes('application/json')) {
      let body = await readJson(request)
      if (body && typeof body === 'object') {
        note = String((body as Record<string, unknown>).note ?? '')
        visibility = (body as Record<string, unknown>).visibility === 'public' ? 'public' : 'private'
      }
    } else {
      let form = await request.formData()
      note = String(form.get('note') ?? '')
      visibility = form.get('visibility') === 'public' ? 'public' : 'private'
    }

    if (!note.trim()) return json({ ok: false, error: 'Note is required.' }, { status: 400 })
    let saved = await addManualNote(note.trim(), visibility)
    return contentType.includes('application/json')
      ? json({ ok: true, note: saved })
      : redirect('/broodcast/dashboard')
  },
}

export const apiZones = {
  async handler({ request }: { request: Request }) {
    if (!isAdminRequest(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    let form = await request.formData()

    if (form.has('public_visible')) {
      await setPublicVisible(form.get('public_visible') === 'true')
      return redirect('/broodcast/dashboard')
    }

    try {
      let zones = JSON.parse(String(form.get('zones') ?? '[]'))
      if (!Array.isArray(zones)) throw new Error('zones must be an array')
      await replaceZones(zones)
      return redirect('/broodcast/dashboard')
    } catch {
      return json({ ok: false, error: 'Zone JSON is invalid.' }, { status: 400 })
    }
  },
}

export const apiReport = {
  async handler() {
    return json(await buildReportData())
  },
}

function LivePage() {
  return ({
    latest,
    recent,
    visible,
    annotations,
    chickIdentities,
  }: {
    latest: Observation | null
    recent: Observation[]
    visible: boolean
    annotations: BrooderAnnotation[]
    chickIdentities: ChickIdentity[]
  }) => (
    <section className="cc-section live-page">
      <SafetyBanner />
      <div className="hero-row">
        <div>
          <p className="eyebrow">Tune in to the Secret Life of Chicks</p>
          <h1>BroodCast</h1>
          <p className="lead">
            A tiny window into the world of our growing flock. BroodCast uses computer vision to
            watch, label, and explain what the chicks are doing—helping us become more attentive
            stewards while the chicks do their thing.
          </p>
        </div>
        <a className="btn btn-secondary" href="/broodcast/report">
          Weekend report
        </a>
      </div>

      {!visible ? <div className="stale-warning">Public visibility is paused by the admin.</div> : null}

      <div className="live-grid">
        <section className="panel stream-panel">
          <div id="stale-warning" className="stale-warning hidden"></div>
          <div id="live-stream-frame" className="stream-frame annotatable-frame">
            {latest?.annotated_frame_url ? (
              <img id="live-image" src={latest.annotated_frame_url} alt="Latest annotated BroodCast frame" />
            ) : (
              <div id="live-empty" className="empty-frame">
                Waiting for the BroodCast to begin...
              </div>
            )}
            <canvas id="annotation-canvas" aria-label="Brooder annotation canvas"></canvas>
            <button
              id="fullscreen-stream-button"
              className="stream-fullscreen-button"
              type="button"
              aria-label="Show stream full screen"
            >
              Full screen
            </button>
            <div id="annotation-freeze-badge" className="freeze-badge hidden">Frozen for annotation</div>
          </div>
          <div className="annotation-toolbar">
            <button id="freeze-frame-button" className="btn btn-secondary" type="button">Freeze frame</button>
            <button id="resume-stream-button" className="btn btn-secondary hidden" type="button">Resume stream</button>
          </div>
          <StatusLine observation={latest} />
        </section>

        <aside className="panel">
          <h2>Current Status</h2>
          <div id="stats-cards" className="stats-grid">
            <StatsCards observation={latest} />
          </div>
          <h3>Ask BroodCast</h3>
          <ChatBox />
        </aside>
      </div>

      <section className="panel audio-panel">
        <div className="panel-heading-row">
          <div>
            <h2>Audio Spectrogram</h2>
            <p id="audio-status" className="muted">Start audio to view the Python audio stream.</p>
          </div>
          <div className="audio-controls">
            <label>
              Channels
              <select id="audio-channel-mode">
                <option value="mono">Mono</option>
                <option value="stereo">Stereo</option>
              </select>
            </label>
            <button id="audio-start-button" className="btn btn-primary" type="button">Start stream</button>
            <button id="audio-stop-button" className="btn btn-secondary hidden" type="button">Stop</button>
          </div>
        </div>
        <div className="spectrogram-shell" aria-label="Live audio spectrogram">
          <canvas id="audio-spectrogram"></canvas>
          <div className="spectrogram-axis">
            <span>High</span>
            <span>Hz</span>
            <span>Low</span>
          </div>
        </div>
        <div id="audio-meter-row" className="audio-meter-row">
          <div>
            <span>Left / mono</span>
            <meter id="audio-meter-left" min="0" max="1" value="0"></meter>
          </div>
          <div>
            <span>Right</span>
            <meter id="audio-meter-right" min="0" max="1" value="0"></meter>
          </div>
        </div>
      </section>

      <section
        id="annotation-lab"
        className="panel annotation-lab"
        data-observation-id={latest?.id ?? ''}
        data-frame-id={latest?.frame_id ?? ''}
        data-detections={JSON.stringify(latest?.detections ?? [])}
        data-annotations={JSON.stringify(annotations.slice(0, 80))}
        data-chick-identities={JSON.stringify(chickIdentities)}
      >
        <div>
          <h2>Annotation Lab</h2>
          <p className="muted">Click or drag on the image to freeze a frame, draw labels, and get Kimi/BAML help.</p>
        </div>
        <div className="annotation-grid">
          <form id="part-annotation-form" className="stack-form">
            <label>
              Label
              <input name="label" list="brooder-labels" placeholder="heater, water, food, waste..." required />
            </label>
            <datalist id="brooder-labels">
              <option value="heater"></option>
              <option value="water"></option>
              <option value="food"></option>
              <option value="waste"></option>
              <option value="bedding"></option>
              <option value="chick"></option>
            </datalist>
            <label>
              Shape
              <select name="kind">
                <option value="box">Box</option>
                <option value="point">Point</option>
              </select>
            </label>
            <input type="hidden" name="geometry" />
            <button className="btn btn-primary" type="submit">
              Save annotation
            </button>
          </form>
          <form id="chick-name-form" className="stack-form">
            <label>
              Detected chick
              <select name="track_id">
                {(latest?.detections ?? []).map((detection) => (
                  <option value={detection.track_id} key={detection.track_id}>
                    {detection.track_id} · {detection.zone}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Name
              <input name="name" placeholder="Peep, Dot, Stripe..." required />
            </label>
            <button className="btn btn-secondary" type="submit">
              Save name
            </button>
          </form>
          <div>
            <h3>Saved labels</h3>
            <div id="annotation-list" className="tag-list"></div>
            <h3>Chick names</h3>
            <div id="chick-name-list" className="tag-list"></div>
            <h3>Kimi assist</h3>
            <div id="annotation-assist" className="annotation-assist muted">Draw or click on the frozen frame for help.</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Recent Observations</h2>
        <ObservationTable observations={recent.slice(0, 8)} />
      </section>
      <script src="/broodcast.js?v=python-audio-spectrogram-1"></script>
    </section>
  )
}

function DashboardPage() {
  return ({ latest, recent, notes, zones, visible }: any) => (
    <section className="cc-section">
      <SafetyBanner />
      <div className="hero-row">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h1>BroodCast Dashboard</h1>
          <p className="lead">Manage your stream, review care notes, and tune the vision system.</p>
        </div>
        <form method="post" action="/broodcast/logout">
          <button className="btn btn-secondary" type="submit">
            Sign out
          </button>
        </form>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Latest Observation</h2>
          <StatusLine observation={latest} />
          <p className="muted">{latest?.summary ?? 'No observation yet.'}</p>
        </section>
        <section className="panel">
          <h2>Stream Visibility</h2>
          <p className="big-value">{visible ? 'Public' : 'Paused'}</p>
          <form method="post" action="/broodcast/api/zones" className="button-row">
            <button className="btn btn-secondary" name="public_visible" value="true" type="submit">
              Show
            </button>
            <button className="btn btn-secondary" name="public_visible" value="false" type="submit">
              Pause
            </button>
          </form>
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Manual Note</h2>
          <form className="stack-form" method="post" action="/broodcast/api/manual-notes">
            <label>
              Note
              <textarea name="note" rows={4} required placeholder="e.g., Refilled water, checked heat lamp..."></textarea>
            </label>
            <label>
              Visibility
              <select name="visibility">
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </label>
            <button className="btn btn-primary" type="submit">
              Add note
            </button>
          </form>
          <div className="note-list">
            {notes.slice(0, 5).map((note: any) => (
              <p key={note.id}>
                <strong>{note.visibility}</strong> {note.note}
              </p>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Vision Config</h2>
          <form className="stack-form" method="post" action="/broodcast/api/zones">
            <textarea name="zones" rows={12}>{JSON.stringify(zones, null, 2)}</textarea>
            <button className="btn btn-primary" type="submit">
              Save zones
            </button>
          </form>
        </section>
      </div>
      <section className="panel">
        <h2>Recent Observations</h2>
        <ObservationTable observations={recent} />
      </section>
    </section>
  )
}

function ReportPage() {
  return ({ observations, notes }: any) => {
    let report = summarizeObservations(observations)
    return (
      <section className="cc-section report-page">
        <SafetyBanner />
        <div className="hero-row">
          <div>
            <p className="eyebrow">Class report</p>
            <h1>BroodCast Weekend Report</h1>
            <p className="lead">A summary of life in the brooder, from computer vision and care notes.</p>
          </div>
          <a className="btn btn-secondary print-button" href="javascript:window.print()">
            Print
          </a>
        </div>
        <div className="stats-grid report-stats">
          <Metric label="Total observations" value={String(report.total)} />
          <Metric label="Average comfort signal" value={report.averageComfort} />
          <Metric label="Primary zone" value={report.topZone} />
          <Metric label="Care events" value={String(notes.length)} />
        </div>
        <section className="panel">
          <h2>The Big Picture</h2>
          <p>
            Over the weekend, we watched the chicks through snapshots and automated zone detection.
            By tracking where they spent their time and how much they moved, BroodCast helped us
            stay attentive to their comfort. This report summarizes those patterns, but human eyes
            always have the final say on food, water, and well-being.
          </p>
        </section>
        <section className="panel">
          <h2>Care Logs</h2>
          {notes.length === 0 ? <p className="muted">No manual notes yet.</p> : null}
          {notes.map((note: any) => (
            <p key={note.id}>
              <strong>{new Date(note.created_at).toLocaleString()}:</strong> {note.note}
            </p>
          ))}
        </section>
        <section className="panel">
          <h2>Evidence Log</h2>
          <ObservationTable observations={observations.slice(0, 12)} />
        </section>
      </section>
    )
  }
}

function StatsCards() {
  return ({ observation }: { observation: Observation | null }) => (
    <>
      <Metric label="Comfort signal" value={observation?.comfort_score ? `${observation.comfort_score}/5` : 'No data'} />
      <Metric label="Chicks detected" value={String(observation?.stats.chick_count ?? observation?.detections.length ?? 0)} />
      <Metric label="Near heater" value={formatPercent(observation?.stats.heater_zone_pct_10m)} />
      <Metric label="Movement" value={formatNumber(observation?.stats.movement_score)} />
    </>
  )
}

function Metric() {
  return ({ label, value }: { label: string; value: string }) => (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ChatBox() {
  return () => (
    <div className="chat-box">
      <form id="chat-form" className="stack-form">
        <textarea name="message" rows={3} placeholder="Ask about the chicks..." required></textarea>
        <div className="quick-prompts">
          <button type="button" data-prompt="Are they too cold?">Too cold?</button>
          <button type="button" data-prompt="What are they doing right now?">Right now?</button>
          <button type="button" data-prompt="What should we check before bedtime?">Bedtime checks</button>
        </div>
        <button className="btn btn-primary" type="submit">
          Ask BroodCast
        </button>
      </form>
      <div id="chat-answer" className="chat-answer muted">Answers will appear here.</div>
    </div>
  )
}

function ObservationTable() {
  return ({ observations }: { observations: Observation[] }) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Chicks</th>
            <th>Comfort</th>
            <th>Summary</th>
            <th>Alerts</th>
          </tr>
        </thead>
        <tbody>
          {observations.length === 0 ? (
            <tr>
              <td colSpan={5}>No observations yet.</td>
            </tr>
          ) : (
            observations.map((observation) => (
              <tr key={observation.id}>
                <td>{new Date(observation.observed_at).toLocaleTimeString()}</td>
                <td>{String(observation.stats.chick_count ?? observation.detections.length)}</td>
                <td>{observation.comfort_score ?? 'unknown'}</td>
                <td>{observation.summary}</td>
                <td>{observation.alerts.length > 0 ? observation.alerts.join(', ') : 'none'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

async function saveBase64Frame(value: string, frameId: unknown) {
  let safeId = typeof frameId === 'string' ? frameId.replace(/[^a-zA-Z0-9_.-]/g, '') : randomUUID()
  let filename = safeId.endsWith('.jpg') || safeId.endsWith('.png') ? safeId : `${safeId}.jpg`
  let base64 = value.includes(',') ? value.split(',').pop()! : value
  let buffer = Buffer.from(base64, 'base64')
  await mkdir(join(process.cwd(), 'public', 'uploads'), { recursive: true })
  await writeFile(join(process.cwd(), 'public', 'uploads', filename), buffer)
  return `/uploads/${filename}`
}

async function buildReportData() {
  let observations = await allObservations()
  let notes = await listManualNotes({ includePrivate: true })
  return { ...summarizeObservations(observations), notes }
}

function summarizeObservations(observations: Observation[]) {
  let comfortValues = observations
    .map((observation) => observation.comfort_score)
    .filter((score): score is number => typeof score === 'number')
  let zoneCounts = new Map<string, number>()
  for (let observation of observations) {
    for (let detection of observation.detections) {
      zoneCounts.set(detection.zone, (zoneCounts.get(detection.zone) ?? 0) + 1)
    }
  }
  let topZone = [...zoneCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown'
  return {
    total: observations.length,
    averageComfort:
      comfortValues.length > 0
        ? `${(comfortValues.reduce((sum, value) => sum + value, 0) / comfortValues.length).toFixed(1)}/5`
        : 'No data',
    topZone,
  }
}

function formatPercent(value: unknown) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'No data'
}

function formatNumber(value: unknown) {
  return typeof value === 'number' ? value.toFixed(2) : 'No data'
}
