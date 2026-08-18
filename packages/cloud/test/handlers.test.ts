import { afterEach, describe, expect, test } from "bun:test"
import { GET as health } from "../api/health"
import { OPTIONS as deviceOptions, POST as deviceCode } from "../api/auth/device/code"
import { handleServices } from "../src/services"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

afterEach(() => {
  if (supabaseUrl === undefined) delete process.env.SUPABASE_URL
  if (supabaseUrl !== undefined) process.env.SUPABASE_URL = supabaseUrl
  if (supabaseSecretKey === undefined) delete process.env.SUPABASE_SECRET_KEY
  if (supabaseSecretKey !== undefined) process.env.SUPABASE_SECRET_KEY = supabaseSecretKey
  if (supabaseServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseServiceRoleKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = supabaseServiceRoleKey
})

describe("cloud handlers", () => {
  test("reports disabled paid capabilities without requiring configuration", async () => {
    const response = await health(new Request("https://cloud.example.com/api/health"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      name: "codetutor-account",
      status: "ok",
      billing: "disabled",
      managed_ai: "disabled",
      sync: "disabled",
    })
  })

  test("rejects unknown clients before accessing Supabase", async () => {
    const response = await deviceCode(
      new Request("https://cloud.example.com/api/auth/device/code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: "unknown" }),
      }),
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "invalid_client" })
  })

  test("fails closed when server secrets are absent", async () => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SECRET_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const response = await deviceCode(
      new Request("https://cloud.example.com/api/auth/device/code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: "codetutor-cli" }),
      }),
    )
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "account_service_unconfigured" })
  })

  test("allows only configured browser origins", async () => {
    const allowed = await deviceOptions(
      new Request("https://cloud.example.com/api/auth/device/code", {
        method: "OPTIONS",
        headers: { origin: "https://codetutor-app-red.vercel.app" },
      }),
    )
    const denied = await deviceOptions(
      new Request("https://cloud.example.com/api/auth/device/code", {
        method: "OPTIONS",
        headers: { origin: "https://untrusted.example.com" },
      }),
    )
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://codetutor-app-red.vercel.app")
    expect(denied.headers.get("access-control-allow-origin")).toBeNull()
  })

  test("serves the public plan catalog through the consolidated function", async () => {
    const response = await handleServices(new Request("https://cloud.example.com/api/services?route=plans"))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { plans: { id: string; limits: { requests_monthly: number } }[] }
    expect(body.plans.map((plan) => plan.id)).toEqual(["free", "starter", "pro"])
    expect(body.plans.find((plan) => plan.id === "pro")?.limits.requests_monthly).toBe(4_000)
  })
})
