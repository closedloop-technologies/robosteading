import { spawn } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

const port = process.env.PORT ?? '44100'
const origin = `http://127.0.0.1:${port}`
const dist = new URL('../dist/', import.meta.url)
const publicDir = new URL('../public/', import.meta.url)
const cname = new URL('../CNAME', import.meta.url)

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })
await cp(publicDir, dist, { recursive: true })

const server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: port, NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let output = ''
server.stdout.on('data', (chunk) => {
  output += chunk
})
server.stderr.on('data', (chunk) => {
  output += chunk
})

try {
  let response
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) {
      throw new Error(`Server exited during static build:\n${output}`)
    }

    try {
      response = await fetch(origin)
      if (response.ok) break
    } catch {
      await delay(250)
    }
  }

  if (!response?.ok) {
    throw new Error(`Timed out waiting for ${origin}`)
  }

  const html = await response.text()
  await writeFile(new URL('index.html', dist), html)
  await writeFile(new URL('CNAME', dist), await readFile(cname))
} finally {
  server.kill('SIGTERM')
}
