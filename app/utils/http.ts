export function json(value: unknown, init?: ResponseInit) {
  let headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(value), { ...init, headers })
}

export function redirect(location: string, status = 303, headers?: HeadersInit) {
  let responseHeaders = new Headers(headers)
  responseHeaders.set('Location', location)
  return new Response(null, { status, headers: responseHeaders })
}

export async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}
