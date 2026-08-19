import { requireIdentity } from "../src/database.js"
import { profileUpdate } from "../src/profile.js"
import { json, methodNotAllowed, readObject, run } from "../src/response.js"

const fields = [
  "display_name",
  "avatar_url",
  "learner_level",
  "goals",
  "languages",
  "frameworks",
  "ide",
  "teaching_style",
  "pace",
  "accessibility",
  "primary_model",
  "helper_model",
  "helper_enabled",
  "diagnostics_opt_in",
  "notification_preferences",
  "minimum_age_confirmed_at",
  "created_at",
  "updated_at",
].join(",")

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET" && request.method !== "PATCH") return methodNotAllowed(request)
    const account = await requireIdentity(request)
    if (!account) return json(request, { error: "unauthorized" }, 401)

    if (request.method === "GET") {
      const result = await account.admin.from("profiles").select(fields).eq("user_id", account.user.id).single()
      if (result.error) throw result.error
      return json(request, { profile: result.data, email: account.user.email ?? "" })
    }

    const body = await readObject(request)
    const update = body ? profileUpdate(body) : null
    if (!update) return json(request, { error: "invalid_profile" }, 400)
    const result = await account.admin
      .from("profiles")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("user_id", account.user.id)
      .select(fields)
      .single()
    if (result.error) throw result.error
    return json(request, { profile: result.data, email: account.user.email ?? "" })
  })

export const GET = handler
export const PATCH = handler
export const OPTIONS = handler
