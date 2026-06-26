import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  loginAction,
  safeAdminNextPath,
  safeAnnotatedFrameUrl,
  safeFrameFilename,
  safeRecentWindowMinutes,
} from './broodcast.tsx'
import { adminCookie, adminToken, isAdminRequest } from '../data/auth.ts'

function loginRequest(next: string, token = 'broodcast') {
  let form = new FormData()
  form.set('token', token)
  form.set('next', next)
  return new Request('http://localhost/broodcast/login', {
    method: 'POST',
    body: form,
  })
}

test('safeAdminNextPath accepts BroodCast paths', () => {
  assert.equal(safeAdminNextPath('/broodcast'), '/broodcast')
  assert.equal(safeAdminNextPath('/broodcast/dashboard'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/live?tab=peeps'), '/broodcast/live?tab=peeps')
  assert.equal(safeAdminNextPath('/broodcast?view=live'), '/broodcast?view=live')
})

test('safeAdminNextPath rejects non-BroodCast redirect targets', () => {
  assert.equal(safeAdminNextPath('https://evil.example'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('//evil.example/broodcast'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/\\evil.example'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/%2e%2e/api/latest'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/%2flive'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/dashboard%3fnext=/broodcast/report'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/%5cevil.example'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast//dashboard'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/live//'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/bad path'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/bad%20path'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/dashboard?next=bad path'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/dashboard?next=bad%20path'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/dashboard#settings'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/live?tab=peeps#timeline'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/%64ashboard'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/dashboard?tab=%70eeps'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/%zz'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/%0dSet-Cookie:bad'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/dashboard?next=%0aSet-Cookie:bad'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcast/dashboard\nSet-Cookie:bad'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/api/latest'), '/broodcast/dashboard')
  assert.equal(safeAdminNextPath('/broodcastevil'), '/broodcast/dashboard')
})

test('loginAction redirects valid admin logins to sanitized local targets', async () => {
  let valid = await loginAction.handler({ request: loginRequest('/broodcast/report') })
  assert.equal(valid.status, 303)
  assert.equal(valid.headers.get('Location'), '/broodcast/report')
  assert.match(valid.headers.get('Set-Cookie') ?? '', /broodcast_admin=broodcast/)

  let rejected = await loginAction.handler({ request: loginRequest('//evil.example') })
  assert.equal(rejected.status, 303)
  assert.equal(rejected.headers.get('Location'), '/broodcast/dashboard')
})

test('loginAction trims pasted admin tokens', async () => {
  let response = await loginAction.handler({ request: loginRequest('/broodcast/report', ' broodcast\n') })

  assert.equal(response.status, 303)
  assert.equal(response.headers.get('Location'), '/broodcast/report')
  assert.match(response.headers.get('Set-Cookie') ?? '', /broodcast_admin=broodcast/)
})

test('loginAction keeps failed tokens on the login flow', async () => {
  let response = await loginAction.handler({ request: loginRequest('/broodcast/report', 'wrong-token') })
  assert.equal(response.status, 303)
  assert.equal(response.headers.get('Location'), '/broodcast/login?error=1')
  assert.equal(response.headers.has('Set-Cookie'), false)
})

test('safeFrameFilename preserves expected image names', () => {
  assert.equal(safeFrameFilename('frame-01.png'), 'frame-01.png')
  assert.equal(safeFrameFilename('coop/frame 02.jpeg'), 'coopframe02.jpg')
  assert.equal(safeFrameFilename('camera.alpha.jpg'), 'cameraalpha.jpg')
})

test('safeFrameFilename falls back when frame ids have no safe stem', () => {
  let filename = safeFrameFilename('../..')
  assert.match(filename, /^[0-9a-f-]{36}\.jpg$/)
  assert.notEqual(filename, '.jpg')
})

test('safeFrameFilename caps long sanitized stems', () => {
  let filename = safeFrameFilename(`${'camera-'.repeat(40)}frame.png`)

  assert.equal(filename.length, 84)
  assert.equal(filename.endsWith('.png'), true)
  assert.equal(filename.slice(0, -4).length, 80)
})

test('safeAnnotatedFrameUrl accepts local uploaded image paths', () => {
  assert.equal(safeAnnotatedFrameUrl('/uploads/frame-01.jpg'), '/uploads/frame-01.jpg')
  assert.equal(safeAnnotatedFrameUrl('/uploads/camera-alpha.PNG'), '/uploads/camera-alpha.PNG')
  assert.equal(safeAnnotatedFrameUrl('/uploads/latest.webp'), '/uploads/latest.webp')
})

test('safeAnnotatedFrameUrl rejects unsafe frame URLs', () => {
  for (let value of [
    'https://evil.example/frame.jpg',
    '//evil.example/frame.jpg',
    '/static/hero-bg.png',
    '/uploads/../secret.jpg',
    '/uploads/%2e%2e/secret.jpg',
    '/uploads/camera%2fframe.jpg',
    '/uploads/archive/frame.jpg',
    '/uploads/frame%0a.jpg',
    '/uploads/frame%41.jpg',
    '/uploads/bad path.jpg',
    '/uploads/.hidden.jpg',
    '/uploads/-frame.jpg',
    '/uploads/frame.name.jpg',
    '/uploads/frame.svg',
    '/uploads/frame.jpg?cache=1',
  ]) {
    assert.equal(safeAnnotatedFrameUrl(value), null, value)
  }
})

test('safeRecentWindowMinutes accepts bounded positive integer windows', () => {
  assert.equal(safeRecentWindowMinutes(null, 30), 30)
  assert.equal(safeRecentWindowMinutes('1', 30), 1)
  assert.equal(safeRecentWindowMinutes('120', 30), 120)
  assert.equal(safeRecentWindowMinutes('1440', 30), 1440)
})

test('safeRecentWindowMinutes rejects malformed or excessive windows', () => {
  for (let value of ['0', '-1', '1.5', ' 30', '30 ', 'Infinity', 'NaN', '1441', '9007199254740992']) {
    assert.equal(safeRecentWindowMinutes(value, 30), 30, value)
  }
})

test('adminToken ignores blank higher-priority environment values', () => {
  let originalAdmin = process.env.ADMIN_TOKEN
  let originalBroodcast = process.env.BROODCAST_ADMIN_TOKEN
  let originalChickcoach = process.env.CHICKCOACH_ADMIN_TOKEN

  try {
    process.env.ADMIN_TOKEN = ''
    process.env.BROODCAST_ADMIN_TOKEN = ' broodcast-secret '
    process.env.CHICKCOACH_ADMIN_TOKEN = 'legacy-secret'

    assert.equal(adminToken(), 'broodcast-secret')
    assert.match(adminCookie(), /broodcast_admin=broodcast-secret/)
    assert.equal(
      isAdminRequest(new Request('http://localhost', { headers: { cookie: 'broodcast_admin=' } })),
      false,
    )
    assert.equal(
      isAdminRequest(new Request('http://localhost', { headers: { cookie: 'broodcast_admin=broodcast-secret' } })),
      true,
    )
  } finally {
    restoreEnv('ADMIN_TOKEN', originalAdmin)
    restoreEnv('BROODCAST_ADMIN_TOKEN', originalBroodcast)
    restoreEnv('CHICKCOACH_ADMIN_TOKEN', originalChickcoach)
  }
})

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}
