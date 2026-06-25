import assert from 'node:assert/strict'
import { test } from 'node:test'

import { loginAction, safeAdminNextPath } from './broodcast.tsx'
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

test('loginAction keeps failed tokens on the login flow', async () => {
  let response = await loginAction.handler({ request: loginRequest('/broodcast/report', 'wrong-token') })
  assert.equal(response.status, 303)
  assert.equal(response.headers.get('Location'), '/broodcast/login?error=1')
  assert.equal(response.headers.has('Set-Cookie'), false)
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
