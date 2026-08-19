import { randomUUID } from "node:crypto"
import { adminRoles, requireAdmin, type AdminRole } from "../../src/admin.js"
import { json, methodNotAllowed, readObject, run } from "../../src/response.js"

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET" && request.method !== "POST") return methodNotAllowed(request)
    const actor = await requireAdmin(request, adminRoles)
    if (!actor) return json(request, { error: "admin_mfa_required" }, 403)

    if (request.method === "GET") {
      const userID = new URL(request.url).searchParams.get("user_id") ?? ""
      if (!userID) return json(request, { error: "user_id_required" }, 400)
      const user = await actor.admin.auth.admin.getUserById(userID)
      if (user.error || !user.data.user) return json(request, { error: "account_not_found" }, 404)
      const [profile, subscription, usage, deletion, fraud, sessions] = await Promise.all([
        actor.admin.from("profiles").select("*").eq("user_id", userID).maybeSingle(),
        actor.admin.from("subscriptions").select("*").eq("user_id", userID).maybeSingle(),
        actor.admin.from("managed_ai_usage").select("*").eq("user_id", userID).order("period_start", { ascending: false }).limit(3),
        actor.admin.from("account_deletion_requests").select("*").eq("user_id", userID).maybeSingle(),
        actor.admin.from("fraud_signals").select("signal_type,risk_score,created_at,expires_at").eq("user_id", userID),
        actor.admin.from("account_sessions").select("id,client_type,device_name,platform,last_seen_at,revoked_at").eq("user_id", userID),
      ])
      const failed = [profile, subscription, usage, deletion, fraud, sessions].find((result) => result.error)
      if (failed?.error) throw failed.error
      return json(request, {
        account: { id: user.data.user.id, email: user.data.user.email, banned_until: user.data.user.banned_until },
        profile: profile.data,
        subscription: subscription.data,
        usage: usage.data,
        deletion: deletion.data,
        fraud_signals: fraud.data,
        sessions: sessions.data,
      })
    }

    const body = await readObject(request)
    const targetUserID = typeof body?.user_id === "string" ? body.user_id : ""
    const action = typeof body?.action === "string" ? body.action : ""
    const reason = typeof body?.reason === "string" ? body.reason.trim() : ""
    if (!targetUserID || reason.length < 3) return json(request, { error: "target_and_reason_required" }, 400)
    const required = rolesFor(action)
    if (!required.includes(actor.role)) return json(request, { error: "admin_role_required" }, 403)
    const auditID = randomUUID()
    const metadata: Record<string, unknown> = {}
    if (action === "revoke_sessions") {
      const result = await actor.admin
        .from("account_sessions")
        .update({ revoked_at: new Date().toISOString(), revoked_reason: "admin_security_action" })
        .eq("user_id", targetUserID)
        .is("revoked_at", null)
      if (result.error) throw result.error
    } else if (action === "ban" || action === "unban") {
      const result = await actor.admin.auth.admin.updateUserById(targetUserID, {
        ban_duration: action === "ban" ? "876000h" : "none",
      })
      if (result.error) throw result.error
    } else if (action === "adjust_credit") {
      const dollars = typeof body?.amount_usd === "number" ? body.amount_usd : Number.NaN
      if (!Number.isFinite(dollars) || dollars === 0 || Math.abs(dollars) > 500) {
        return json(request, { error: "invalid_credit_adjustment" }, 400)
      }
      const result = await actor.admin.rpc("admin_adjust_managed_ai_credit", {
        p_user_id: targetUserID,
        p_delta_nanos: Math.round(dollars * 1_000_000_000),
        p_reference: auditID,
      })
      if (result.error) throw result.error
      metadata.applied_nanos = result.data
    } else {
      return json(request, { error: "invalid_admin_action" }, 400)
    }
    const audit = await actor.admin.from("admin_audit_events").insert({
      id: auditID,
      actor_user_id: actor.user.id,
      actor_role: actor.role,
      action,
      target_user_id: targetUserID,
      reason,
      metadata,
    })
    if (audit.error) throw audit.error
    return json(request, { completed: true, audit_id: auditID, metadata })
  })

const rolesFor = (action: string): readonly AdminRole[] => {
  if (action === "adjust_credit") return ["billing", "superadmin"]
  if (action === "ban" || action === "unban") return ["security", "superadmin"]
  if (action === "revoke_sessions") return ["support", "security", "superadmin"]
  return []
}

export const GET = handler
export const POST = handler
export const OPTIONS = handler
