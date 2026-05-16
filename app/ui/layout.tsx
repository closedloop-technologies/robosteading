import type { RemixNode } from 'remix/ui'

import type { Observation } from '../data/store.ts'

export function PageShell() {
  return ({
    title,
    description,
    children,
  }: {
    title: string
    description: string
    children: RemixNode
  }) => (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="icon" href="/favicon.ico" />
        <link rel="stylesheet" href="/chickcoach.css" />
      </head>
      <body className="cc-body">
        <header className="cc-header">
          <a className="cc-brand" href="/chickcheck">
            <span className="cc-mark">🐣</span>
            <span>BroodCast Live</span>
          </a>
          <nav className="cc-nav">
            <a href="/chickcheck/live">Live</a>
            <a href="/chickcheck/report">Report</a>
            <a href="/chickcheck/dashboard">Dashboard</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}

export function SafetyBanner() {
  return () => (
    <div className="safety-banner" role="note">
      BroodCast is an observational learning tool. It does not replace adult supervision. Always
      directly check food, water, temperature, bedding, and chick behavior.
    </div>
  )
}

export function StatusLine() {
  return ({ observation }: { observation: Observation | null }) => {
    if (!observation) {
      return <p className="muted">No observations have been received yet.</p>
    }

    let chickCount = observation.stats.chick_count ?? observation.detections.length
    return (
      <div className="status-list">
        <p>
          <strong>Last updated:</strong>{' '}
          <span data-live-status="last-updated">{new Date(observation.observed_at).toLocaleString()}</span>
        </p>
        <p>
          <strong>Chicks detected:</strong>{' '}
          <span data-live-status="chicks-detected">{String(chickCount)}</span>
        </p>
        <p>
          <strong>Comfort signal:</strong>{' '}
          <span data-live-status="comfort-signal">
            {observation.comfort_score ? `${observation.comfort_score}/5` : 'unknown'}
          </span>
        </p>
        <p>
          <strong>Alerts:</strong>{' '}
          <span data-live-status="alerts">
            {observation.alerts.length > 0 ? observation.alerts.join(', ') : 'none'}
          </span>
        </p>
      </div>
    )
  }
}
