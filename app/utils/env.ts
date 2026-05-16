import { existsSync, readFileSync } from 'node:fs'

export function loadDotEnv(path = '.env') {
  if (!existsSync(path)) return

  let lines = readFileSync(path, 'utf8').split(/\r?\n/)
  for (let line of lines) {
    let trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    let equals = trimmed.indexOf('=')
    if (equals === -1) continue

    let key = trimmed.slice(0, equals).trim()
    let value = trimmed.slice(equals + 1).trim()
    if (!key || process.env[key] !== undefined) continue

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}
