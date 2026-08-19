import { requireIdentity, requireStepUpUser } from "../../src/database.js"
import { json, methodNotAllowed, readObject, run } from "../../src/response.js"
import { maximumServiceKeys, serviceKeyInput } from "../../src/service-key.js"
import { randomToken, tokenHash } from "../../src/token.js"

const fields =
  "id,name,token_prefix,scopes,model_allowlist,request_limit,request_count,credit_limit_nanos,cost_nanos,expires_at,last_used_at,revoked_at,created_at"

const handler = (request: Request) =>
  run(request, async () => {
    if (!new Set(["GET", "POST", "DELETE"]).has(request.method)) return methodNotAllowed(request)

    if (request.method === "GET") {
      const account = await requireIdentity(request)
      if (!account) return json(request, { error: "unauthorized" }, 401)
      const result = await account.admin
        .from("service_keys")
        .select(fields)
        .eq("user_id", account.user.id)
        .order("created_at", { ascending: false })
      if (result.error) throw result.error
      return json(request, { service_keys: result.data })
    }

    const account = await requireStepUpUser(request)
    if (!account) return json(request, { error: "reauthentication_required" }, 401)
    const body = await readObject(request)

    if (request.method === "DELETE") {
      const keyID = typeof body?.id === "string" ? body.id : ""
      if (!keyID) return json(request, { error: "service_key_id_required" }, 400)
      const now = new Date().toISOString()
      const result = await account.admin
        .from("service_keys")
        .update({ revoked_at: now })
        .eq("id", keyID)
        .eq("user_id", account.user.id)
        .is("revoked_at", null)
        .select("id")
        .maybeSingle()
      if (result.error) throw result.error
      if (!result.data) return json(request, { error: "service_key_not_found" }, 404)
      const audit = await account.admin.from("account_audit_events").insert({
        user_id: account.user.id,
        actor_user_id: account.user.id,
        event_type: "service_key.revoked",
        target_id: keyID,
      })
      if (audit.error) throw audit.error
      return json(request, { revoked: true })
    }

    if (!body) return json(request, { error: "invalid_service_key" }, 400)
    const input = serviceKeyInput(body)
    if (!input) return json(request, { error: "invalid_service_key" }, 400)
    const count = await account.admin
      .from("service_keys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", account.user.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
    if (count.error) throw count.error
    if ((count.count ?? 0) >= maximumServiceKeys) return json(request, { error: "service_key_limit" }, 409)

    const secret = `ctsk_${randomToken()}`
    const result = await account.admin
      .from("service_keys")
      .insert({
        user_id: account.user.id,
        name: input.name,
        token_prefix: secret.slice(0, 14),
        token_hash: await tokenHash(secret),
        scopes: input.scopes,
        model_allowlist: input.models,
        request_limit: input.requestLimit,
        credit_limit_nanos: input.creditLimitNanos,
        expires_at: input.expiresAt,
      })
      .select(fields)
      .single()
    if (result.error) throw result.error
    const audit = await account.admin.from("account_audit_events").insert({
      user_id: account.user.id,
      actor_user_id: account.user.id,
      event_type: "service_key.created",
      target_id: result.data.id,
      metadata: { scopes: input.scopes, models: input.models, expires_at: input.expiresAt },
    })
    if (audit.error) throw audit.error
    return json(request, { ...result.data, secret }, 201)
  })

export const GET = handler
export const POST = handler
export const DELETE = handler
export const OPTIONS = handler
