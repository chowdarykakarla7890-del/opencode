import { requireRecentSupabaseUser, requireStepUpUser } from "../../src/database.js"
import { json, methodNotAllowed, readObject, run } from "../../src/response.js"
import { randomToken, tokenHash } from "../../src/token.js"

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "POST") return methodNotAllowed(request)
    const body = await readObject(request)
    if (body?.action === "generate") {
      const account = await requireStepUpUser(request)
      if (!account) return json(request, { error: "reauthentication_required" }, 401)
      const codes = Array.from({ length: 10 }, recoveryCode)
      const cleared = await account.admin.from("mfa_recovery_codes").delete().eq("user_id", account.user.id)
      if (cleared.error) throw cleared.error
      const rows = await Promise.all(
        codes.map(async (code) => ({ user_id: account.user.id, code_hash: await tokenHash(code) })),
      )
      const inserted = await account.admin.from("mfa_recovery_codes").insert(rows)
      if (inserted.error) throw inserted.error
      return json(request, { recovery_codes: codes }, 201)
    }

    if (body?.action !== "recover" || typeof body.code !== "string") {
      return json(request, { error: "invalid_recovery_request" }, 400)
    }
    const account = await requireRecentSupabaseUser(request)
    if (!account) return json(request, { error: "reauthentication_required" }, 401)
    const result = await account.admin
      .from("mfa_recovery_codes")
      .select("id")
      .eq("user_id", account.user.id)
      .eq("code_hash", await tokenHash(body.code.trim().toUpperCase()))
      .is("used_at", null)
      .maybeSingle()
    if (result.error) throw result.error
    if (!result.data) return json(request, { error: "invalid_recovery_code" }, 403)
    const used = await account.admin
      .from("mfa_recovery_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", result.data.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle()
    if (used.error) throw used.error
    if (!used.data) return json(request, { error: "recovery_code_used" }, 409)
    const factors = await account.admin.auth.admin.mfa.listFactors({ userId: account.user.id })
    if (factors.error) throw factors.error
    for (const factor of factors.data.factors) {
      const removed = await account.admin.auth.admin.mfa.deleteFactor({ userId: account.user.id, id: factor.id })
      if (removed.error) throw removed.error
    }
    const now = new Date().toISOString()
    const sessions = await account.admin
      .from("account_sessions")
      .update({ revoked_at: now, revoked_reason: "mfa_recovery", updated_at: now })
      .eq("user_id", account.user.id)
      .is("revoked_at", null)
    if (sessions.error) throw sessions.error
    const audit = await account.admin.from("account_audit_events").insert({
      user_id: account.user.id,
      actor_user_id: account.user.id,
      event_type: "mfa.recovered",
    })
    if (audit.error) throw audit.error
    return json(request, { recovered: true, reauthentication_required: true })
  })

const recoveryCode = () => {
  const value = randomToken().replace(/[^A-Za-z0-9]/g, "").slice(0, 16).toUpperCase()
  return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}`
}

export const POST = handler
export const OPTIONS = handler
