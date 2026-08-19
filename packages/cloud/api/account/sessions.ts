import { requireIdentity } from "../../src/database.js"
import { json, methodNotAllowed, readObject, run } from "../../src/response.js"

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET" && request.method !== "DELETE") return methodNotAllowed(request)
    const account = await requireIdentity(request)
    if (!account) return json(request, { error: "unauthorized" }, 401)

    if (request.method === "GET") {
      const result = await account.admin
        .from("account_sessions")
        .select(
          "id,client_id,client_type,device_name,platform,last_seen_at,access_expires_at,refresh_expires_at,created_at,revoked_at,revoked_reason",
        )
        .eq("user_id", account.user.id)
        .order("last_seen_at", { ascending: false })
      if (result.error) throw result.error
      return json(request, { current_session_id: account.kind === "account" ? account.sessionID : null, sessions: result.data })
    }

    const body = await readObject(request)
    const sessionID = typeof body?.session_id === "string" ? body.session_id : null
    const all = body?.all === true
    if (!sessionID && !all) return json(request, { error: "session_id_required" }, 400)
    const now = new Date().toISOString()
    let query = account.admin
      .from("account_sessions")
      .update({ revoked_at: now, revoked_reason: "user_revoked", updated_at: now })
      .eq("user_id", account.user.id)
      .is("revoked_at", null)
    if (!all) query = query.eq("id", sessionID)
    const result = await query.select("id")
    if (result.error) throw result.error
    return json(request, { revoked: result.data.map((item) => item.id) })
  })

export const GET = handler
export const DELETE = handler
export const OPTIONS = handler
