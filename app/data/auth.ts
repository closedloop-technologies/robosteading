const cookieName = 'chickcoach_admin'

export function adminToken() {
  return process.env.ADMIN_TOKEN ?? process.env.CHICKCOACH_ADMIN_TOKEN ?? 'chickcoach'
}

export function isAdminRequest(request: Request) {
  let cookie = request.headers.get('cookie') ?? ''
  return cookie
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${cookieName}=${encodeURIComponent(adminToken())}`)
}

export function adminCookie() {
  return `${cookieName}=${encodeURIComponent(adminToken())}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`
}

export function clearAdminCookie() {
  return `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
}
