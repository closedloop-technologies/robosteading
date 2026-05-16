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
        <title>RoboSteading - AI Automation for the Homestead</title>
        <meta
          name="description"
          content="AI automation for the homestead, ranging from everything from timers, smart automation, home lab stuff to robots."
        />
        <meta
          name="keywords"
          content="robosteading, AI automation, farming, homelab, smart automation, robotics, homestead"
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
              <a href="#value">Philosophy</a>
              <a href="#use-cases">Components</a>
              <a href="#inquire" className="nav-cta">
                Join the Movement →
              </a>
            </nav>
          </div>
        </header>

        <section className="hero" id="hero">
          <div className="hero-bg" aria-hidden="true"></div>
          <div className="hero-content">
            <span className="hero-badge">✦ The Future of Agriculture</span>
            <h1>
              <span className="highlight">AI Automation</span>
              <br />
              For the Modern Homestead
            </h1>
            <p className="hero-subtitle">
              Bring the cutting-edge of technology back to the earth. From simple IoT timers and
              smart automation to advanced robotics and your own home lab.
            </p>
            <div className="hero-actions">
              <a href="#inquire" className="btn btn-primary" id="hero-cta">
                Explore Setup →
              </a>
              <a href="#value" className="btn btn-secondary">
                Learn more
              </a>
            </div>
          </div>
        </section>

        <section className="section" id="value">
          <div className="container">
            <div className="reveal">
              <span className="section-label">Core Philosophy</span>
              <h2 className="section-title">Grow Smarter, Not&nbsp;Harder</h2>
              <p className="section-subtitle">
                Embracing the earth does not mean abandoning technology. We leverage powerful
                open-source models, affordable sensors, and local-first architectures to
                revolutionize small scale farming and living.
              </p>
            </div>
            <div className="value-grid reveal-stagger">
              <ValueCard icon="⏱️" title="Smart Timers">
                Automate irrigation, lighting, and feeding with precision schedules that adapt to
                local weather data.
              </ValueCard>
              <ValueCard icon="🧠" title="Homelab Brain">
                Run local LLMs and home assistants that maintain ultimate privacy while
                orchestrating the farm.
              </ValueCard>
              <ValueCard icon="🤖" title="Ag-Robotics">
                Tending crops, autonomously maneuvering terrain, and deploying computer vision for
                pest control.
              </ValueCard>
              <ValueCard icon="📊" title="Data Driven">
                Everything from soil moisture and pH to greenhouse temperatures logged into a
                real-time dashboard.
              </ValueCard>
            </div>
          </div>
        </section>

        <section className="section" id="use-cases">
          <div className="container">
            <div className="reveal">
              <span className="section-label">Ecosystem</span>
              <h2 className="section-title">The Complete&nbsp;Stack</h2>
              <p className="section-subtitle">
                The homestead of the future is built iteratively. Here is what you need to get
                started.
              </p>
            </div>
            <div className="use-cases-list reveal-stagger">
              <UseCase title="Sensors & Telemetry">
                Soil probes, environmental monitors, esp32 microcontrollers, and weather stations.
              </UseCase>
              <UseCase title="Local Cloud">
                A ruggedized server rack running Proxmox, HomeAssistant, and local vector
                databases.
              </UseCase>
              <UseCase title="AI Orchestrator">
                An agent that analyzes telemetry trends to predict water needs and yield outcomes.
              </UseCase>
              <UseCase title="Actuators">
                Automated solenoid valves, robotic arms, and mechanized rovers for physical
                interaction.
              </UseCase>
            </div>
          </div>
        </section>

        <section className="cta-band" id="inquire">
          <div className="container reveal">
            <h2>Join the RoboSteading&nbsp;Network</h2>
            <p>
              Ready to automate your homestead and embrace the decentralized agriculture movement?
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
