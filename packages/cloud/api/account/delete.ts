import { requireStepUpUser } from "../../src/database.js"
import { json, methodNotAllowed, readObject, run } from "../../src/response.js"

const recoveryDays = 7

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "POST" && request.method !== "DELETE") return methodNotAllowed(request)
    const account = await requireStepUpUser(request, request.method === "DELETE")
    if (!account) return json(request, { error: "reauthentication_required" }, 401)
    const body = await readObject(request)

    if (request.method === "DELETE") {
      const now = new Date().toISOString()
      const requestResult = await account.admin
        .from("account_deletion_requests")
        .update({ status: "cancelled", cancelled_at: now })
        .eq("user_id", account.user.id)
        .eq("status", "scheduled")
      if (requestResult.error) throw requestResult.error
      const profile = await account.admin
        .from("profiles")
        .update({ deleted_at: null, deletion_scheduled_for: null, updated_at: now })
        .eq("user_id", account.user.id)
      if (profile.error) throw profile.error
      return json(request, { cancelled: true })
    }

    if (body?.confirm !== "DELETE") return json(request, { error: "deletion_confirmation_required" }, 400)
    const now = new Date().toISOString()
    const scheduledFor = new Date(Date.now() + recoveryDays * 24 * 60 * 60 * 1000).toISOString()
    const requestResult = await account.admin.from("account_deletion_requests").upsert({
      user_id: account.user.id,
      status: "scheduled",
      scheduled_for: scheduledFor,
      requested_at: now,
      cancelled_at: null,
      completed_at: null,
    })
    if (requestResult.error) throw requestResult.error
    const profile = await account.admin
      .from("profiles")
      .update({ deleted_at: now, deletion_scheduled_for: scheduledFor, updated_at: now })
      .eq("user_id", account.user.id)
    if (profile.error) throw profile.error
    const sessions = await account.admin
      .from("account_sessions")
      .update({ revoked_at: now, revoked_reason: "account_deletion", updated_at: now })
      .eq("user_id", account.user.id)
      .is("revoked_at", null)
    if (sessions.error) throw sessions.error
    const keys = await account.admin
      .from("service_keys")
      .update({ revoked_at: now })
      .eq("user_id", account.user.id)
      .is("revoked_at", null)
    if (keys.error) throw keys.error
    const audit = await account.admin.from("account_audit_events").insert({
      user_id: account.user.id,
      actor_user_id: account.user.id,
      event_type: "account.deletion_scheduled",
      metadata: { scheduled_for: scheduledFor },
    })
    if (audit.error) throw audit.error
    return json(request, { scheduled: true, scheduled_for: scheduledFor })
  })

export const POST = handler
export const DELETE = handler
export const OPTIONS = handler
