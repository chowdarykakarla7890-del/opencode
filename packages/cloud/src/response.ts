import { allowedOrigins, ConfigurationError } from "./env.js"

const baseHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
}

export const corsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get("origin")
  if (!origin || !allowedOrigins().has(origin)) return {}
  return {
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, PATCH, POST, DELETE, OPTIONS",
    "access-control-allow-origin": origin,
    vary: "Origin",
  }
}

export const json = (request: Request, body: unknown, status = 200) =>
  Response.json(body, { status, headers: { ...baseHeaders, ...corsHeaders(request) } })

export const raw = (request: Request, body: BodyInit | null, init?: ResponseInit) =>
  new Response(body, {
    ...init,
    headers: { ...corsHeaders(request), ...Object.fromEntries(new Headers(init?.headers)) },
  })

export const options = (request: Request) => new Response(null, { status: 204, headers: corsHeaders(request) })

export const methodNotAllowed = (request: Request) => json(request, { error: "method_not_allowed" }, 405)

export const run = async (request: Request, handler: () => Promise<Response>) => {
  if (request.method === "OPTIONS") return options(request)
  return handler().catch((cause: unknown) => {
    if (cause instanceof ConfigurationError) {
      return json(request, { error: "account_service_unconfigured" }, 503)
    }
    console.error("CodeTutor account request failed", cause)
    return json(request, { error: "account_service_error" }, 500)
  })
}

export const readObject = async (request: Request) => {
  const value: unknown = await request.json().catch(() => null)
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export const bearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization")
  if (!authorization?.startsWith("Bearer ")) return null
  const value = authorization.slice("Bearer ".length).trim()
  return value || null
}
