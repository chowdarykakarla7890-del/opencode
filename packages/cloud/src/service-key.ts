export const serviceKeyScopes = ["managed_ai:invoke", "models:read", "usage:read"] as const
export const maximumServiceKeys = 5
export const maximumServiceKeyLifetimeDays = 90

export const serviceKeyInput = (input: Record<string, unknown>) => {
  const name = typeof input.name === "string" ? input.name.trim() : ""
  if (!name || name.length > 80) return null
  const expiresAt = typeof input.expires_at === "string" ? new Date(input.expires_at) : null
  if (!expiresAt || !Number.isFinite(expiresAt.getTime())) return null
  if (expiresAt.getTime() <= Date.now()) return null
  if (expiresAt.getTime() > Date.now() + maximumServiceKeyLifetimeDays * 24 * 60 * 60 * 1000) return null
  const scopes = Array.isArray(input.scopes) ? input.scopes : [...serviceKeyScopes]
  if (!scopes.length || scopes.some((scope) => !serviceKeyScopes.includes(scope as (typeof serviceKeyScopes)[number])))
    return null
  const models = Array.isArray(input.model_allowlist) ? input.model_allowlist : []
  if (models.length > 100 || models.some((model) => typeof model !== "string" || !model || model.length > 200)) return null
  const requestLimit = input.request_limit === null || input.request_limit === undefined ? null : input.request_limit
  if (requestLimit !== null && (!Number.isInteger(requestLimit) || (requestLimit as number) <= 0)) return null
  const creditBudget =
    input.credit_budget_usd === null || input.credit_budget_usd === undefined ? null : input.credit_budget_usd
  if (creditBudget !== null && (typeof creditBudget !== "number" || !Number.isFinite(creditBudget) || creditBudget <= 0))
    return null
  return {
    name,
    expiresAt: expiresAt.toISOString(),
    scopes: [...new Set(scopes as string[])],
    models: [...new Set(models as string[])],
    requestLimit: requestLimit as number | null,
    creditLimitNanos: creditBudget === null ? null : Math.ceil(creditBudget * 1_000_000_000),
  }
}

export const reserveServiceKey = async (
  admin: SupabaseClient,
  input: { keyID: string; requestID: string; model: string; costNanos: number },
) => {
  const result = await admin.rpc("reserve_service_key_usage", {
    p_service_key_id: input.keyID,
    p_request_id: input.requestID,
    p_model: input.model,
    p_reserved_cost_nanos: input.costNanos,
  })
  if (result.error) throw result.error
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
    return { ok: false as const, error: "service_key_error" }
  }
  const data = result.data as Record<string, unknown>
  return data.ok === true ? { ok: true as const } : { ok: false as const, error: String(data.error ?? "service_key_error") }
}

export const finalizeServiceKey = async (
  admin: SupabaseClient,
  input: { keyID: string; requestID: string; costNanos: number; status: "completed" | "released" },
) => {
  const result = await admin.rpc("finalize_service_key_usage", {
    p_service_key_id: input.keyID,
    p_request_id: input.requestID,
    p_actual_cost_nanos: input.costNanos,
    p_status: input.status,
  })
  if (result.error) throw result.error
}
import type { SupabaseClient } from "@supabase/supabase-js"
