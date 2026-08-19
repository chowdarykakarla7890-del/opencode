import { requireRecentSupabaseUser } from "../../src/database.js"
import { json, methodNotAllowed, run } from "../../src/response.js"

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET") return methodNotAllowed(request)
    const account = await requireRecentSupabaseUser(request)
    if (!account) return json(request, { error: "reauthentication_required" }, 401)
    const [profile, progress, subscriptions, usage, topups, sessions, serviceKeys] = await Promise.all([
      account.admin.from("profiles").select("*").eq("user_id", account.user.id).maybeSingle(),
      account.admin.from("learning_progress").select("*").eq("user_id", account.user.id),
      account.admin.from("subscriptions").select("*").eq("user_id", account.user.id),
      account.admin.from("managed_ai_usage").select("*").eq("user_id", account.user.id),
      account.admin.from("managed_ai_credit_grants").select("*").eq("user_id", account.user.id),
      account.admin
        .from("account_sessions")
        .select("id,client_id,client_type,device_name,platform,last_seen_at,created_at,revoked_at")
        .eq("user_id", account.user.id),
      account.admin
        .from("service_keys")
        .select("id,name,token_prefix,scopes,model_allowlist,expires_at,last_used_at,revoked_at,created_at")
        .eq("user_id", account.user.id),
    ])
    const failed = [profile, progress, subscriptions, usage, topups, sessions, serviceKeys].find((result) => result.error)
    if (failed?.error) throw failed.error
    return json(request, {
      exported_at: new Date().toISOString(),
      account: { id: account.user.id, email: account.user.email ?? "" },
      profile: profile.data,
      learning_progress: progress.data,
      subscriptions: subscriptions.data,
      usage_periods: usage.data,
      credit_grants: topups.data,
      account_sessions: sessions.data,
      service_keys: serviceKeys.data,
    })
  })

export const GET = handler
export const OPTIONS = handler
