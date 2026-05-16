import { spawn } from 'node:child_process'

const commands = [
  ['web', 'npm', ['run', 'dev:web']],
  ['worker', 'npm', ['run', 'dev:worker']],
]

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, {
    env: process.env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (chunk) => process.stdout.write(prefix(name, chunk)))
  child.stderr.on('data', (chunk) => process.stderr.write(prefix(name, chunk)))
  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    console.error(`[${name}] exited with ${signal ?? code}`)
    shutdown(code || 1)
  })

  return child
})

let shuttingDown = false

process.on('SIGINT', () => shutdown(130))
process.on('SIGTERM', () => shutdown(143))

function prefix(name, chunk) {
  return chunk
    .toString()
    .split(/\n/)
    .map((line, index, lines) => (index === lines.length - 1 && line === '' ? '' : `[${name}] ${line}`))
    .join('\n')
}

function shutdown(code) {
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(code), 300)
}
