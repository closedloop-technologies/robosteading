import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { render } from '../utils/render.tsx'

export const home: BuildAction<'GET', typeof routes.home> = {
  handler({ request }) {
    return render(<HomePage />, request)
  },
}

function HomePage() {
  return () => (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>RoboSteading - AI Garden Automation</title>
        <meta
          name="description"
          content="AI garden automation with camera monitoring, watering control, agentic research, and sim-to-real 3D plant state modeling."
        />
        <meta
          name="keywords"
          content="robosteading, AI garden automation, smart irrigation, computer vision, digital twin, sim2real, homestead"
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicons/apple-touch-icon.png" />
        <link rel="manifest" href="/favicons/site.webmanifest" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/index.css" />
      </head>

      <body>
        <header className="site-header" id="top">
          <div className="container">
            <a href="#top" className="logo">
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="logo-icon"
              >
                <defs>
                  <linearGradient
                    id="logo-gradient"
                    x1="0"
                    y1="0"
                    x2="40"
                    y2="40"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#10b981" />
                    <stop offset="1" stopColor="#0ea5e9" />
                  </linearGradient>
                </defs>
                <rect width="40" height="40" rx="12" fill="url(#logo-gradient)" />
                <path
                  d="M20 10L28 14.5V23.5L20 28L12 23.5V14.5L20 10Z"
                  fill="white"
                  fillOpacity="0.9"
                />
                <path d="M15 16L25 16V22L15 22V16Z" fill="white" fillOpacity="0.5" />
              </svg>
              <span className="logo-text">
                Robo<span>Steading</span>
              </span>
            </a>
            <button
              className="hamburger"
              id="hamburger"
              aria-label="Toggle menu"
              aria-expanded="false"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
            <nav className="nav-links" id="nav-links">
              <a href="#value">Garden OS</a>
              <a href="#use-cases">Control Loop</a>
              <a href="#digital-twin">3D Parity</a>
              <a href="#inquire" className="nav-cta">
                Build with us →
              </a>
            </nav>
          </div>
        </header>

        <section className="hero" id="hero">
          <div className="hero-bg" aria-hidden="true"></div>
          <div className="hero-content">
            <span className="hero-badge">✦ Garden Intelligence Layer</span>
            <h1>
              <span className="highlight">Computer Vision</span>
              <br />
              For the Living Garden
            </h1>
            <p className="hero-subtitle">
              RoboSteading watches plant growth, controls watering, and gives an AI agent the
              sensor history, research context, and domain knowledge needed to reason about the
              garden.
            </p>
            <div className="hero-actions">
              <a href="/broodcast" className="btn btn-primary">
                Open BroodCast →
              </a>
              <a href="#inquire" className="btn btn-primary" id="hero-cta">
                Discuss a Garden Setup →
              </a>
              <a href="#value" className="btn btn-secondary">
                See the loop
              </a>
            </div>
          </div>
        </section>

        <section className="section" id="value">
          <div className="container">
            <div className="reveal">
              <span className="section-label">Garden OS</span>
              <h2 className="section-title">Observe, Decide, Act, Learn</h2>
              <p className="section-subtitle">
                A small garden becomes easier to manage when cameras, irrigation, telemetry, and
                plant knowledge share one operating context. The system closes the loop from visual
                evidence to physical action.
              </p>
            </div>
            <div className="value-grid reveal-stagger">
              <ValueCard icon="📷" title="Camera Monitoring">
                Track growth stage, canopy coverage, fruit readiness, pest pressure, wilting, and
                setup issues from recurring garden images.
              </ValueCard>
              <ValueCard icon="💧" title="Watering Control">
                Drive irrigation zones from schedules, soil conditions, weather, and model
                confidence instead of fixed timers alone.
              </ValueCard>
              <ValueCard icon="🧠" title="AI Garden Agent">
                Ask what changed, what to pick, what failed, or what to try next. The agent can
                query local data and bring in outside research.
              </ValueCard>
              <ValueCard icon="🌱" title="Growth State Memory">
                Keep a history of plant observations, annotations, interventions, and outcomes so
                the garden gets easier to reason about over time.
              </ValueCard>
            </div>
          </div>
        </section>

        <section className="section" id="use-cases">
          <div className="container">
            <div className="reveal">
              <span className="section-label">Control Loop</span>
              <h2 className="section-title">From Camera Frame to Garden Action</h2>
              <p className="section-subtitle">
                The garden stack is built for local hardware first, with narrow APIs for trusted
                ingestion, dashboards, and agent queries.
              </p>
            </div>
            <div className="use-cases-list reveal-stagger">
              <UseCase title="Visual Capture">
                Garden cameras produce a repeatable view of beds, trellises, containers, and
                trouble spots.
              </UseCase>
              <UseCase title="State Classification">
                Vision models label plant health, growth phase, harvest signals, and debugging
                cues like blocked emitters or fallen supports.
              </UseCase>
              <UseCase title="Irrigation Decisions">
                Watering can be triggered, held, or adjusted by zone using observations,
                forecasts, and recent intervention history.
              </UseCase>
              <UseCase title="Queryable Knowledge">
                The agent answers from garden data, plant-care knowledge, and research instead of
                relying on generic chat context.
              </UseCase>
            </div>
          </div>
        </section>

        <section className="section digital-twin-section" id="digital-twin">
          <div className="container twin-layout">
            <div className="reveal">
              <span className="section-label">Sim2Real Parity</span>
              <h2 className="section-title">A 3D Garden Model That Learns the Real Garden</h2>
              <p className="section-subtitle">
                Camera observations should align with a living 3D model of beds, plants, supports,
                and irrigation zones. That parity makes plant state classification easier to
                inspect, debug, and improve.
              </p>
              <div className="twin-points">
                <span>Plant geometry and canopy growth</span>
                <span>Harvest readiness and growth stage</span>
                <span>Water zones, shadows, and constraints</span>
              </div>
            </div>
            <div className="garden-model" aria-label="3D garden model preview">
              <div className="model-bed">
                <span className="model-plant plant-a"></span>
                <span className="model-plant plant-b"></span>
                <span className="model-plant plant-c"></span>
                <span className="model-plant plant-d"></span>
                <span className="model-line line-a"></span>
                <span className="model-line line-b"></span>
                <span className="model-camera"></span>
                <span className="model-water"></span>
              </div>
              <div className="model-readout">
                <span>State map</span>
                <strong>Growth: vegetative</strong>
                <strong>Watering: zone 2 pending</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="cta-band" id="inquire">
          <div className="container reveal">
            <h2>Build the Garden Control Layer</h2>
            <p>
              Bring cameras, irrigation, plant state, and AI research into one garden-aware system.
            </p>
            <a
              href="mailto:sean@closedloop.tech?subject=Inquiry%20About%20Robosteading"
              className="btn btn-primary"
              id="cta-inquire"
            >
              Contact the Founder →
            </a>
          </div>
        </section>

        <footer className="site-footer">
          <p>
            &copy; 2026 RoboSteading &middot;{' '}
            <a href="https://closedloop.tech" target="_blank" rel="noopener noreferrer">
              closedloop.tech
            </a>
          </p>
        </footer>

        <script src="/site.js"></script>
      </body>
    </html>
  )
}

function ValueCard() {
  return ({ icon, title, children }: { icon: string; title: string; children: string }) => (
    <div className="glass-card value-card">
      <div className="value-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}

function UseCase() {
  return ({ title, children }: { title: string; children: string }) => (
    <div className="glass-card use-case-item">
      <div className="use-case-check">✓</div>
      <div>
        <h4>{title}</h4>
        <p>{children}</p>
      </div>
    </div>
  )
}
