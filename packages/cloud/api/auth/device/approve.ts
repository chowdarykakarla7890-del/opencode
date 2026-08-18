import { requireSupabaseUser } from "../../../src/database.js"
import { json, methodNotAllowed, readObject, run } from "../../../src/response.js"
import { tokenHash } from "../../../src/token.js"

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "POST") return methodNotAllowed(request)
    const account = await requireSupabaseUser(request)
    if (!account) return json(request, { error: "unauthorized" }, 401)
    const body = await readObject(request)
    const userCode = typeof body?.user_code === "string" ? body.user_code.trim().toUpperCase() : ""
    if (!userCode) return json(request, { error: "invalid_user_code" }, 400)

    const { data, error } = await account.admin
      .from("device_authorizations")
      .select("device_code_hash,status,user_id,expires_at")
      .eq("user_code_hash", await tokenHash(userCode))
      .maybeSingle()
    if (error) throw error
    if (!data || Date.parse(data.expires_at) <= Date.now()) {
      return json(request, { error: "invalid_user_code" }, 400)
    }
    if ((data.status === "approved" || data.status === "consumed") && data.user_id === account.user.id) {
      return json(request, { approved: true })
    }
    if (data.status !== "pending") return json(request, { error: "invalid_user_code" }, 400)

    const result = await account.admin
      .from("device_authorizations")
      .update({ status: "approved", user_id: account.user.id, approved_at: new Date().toISOString() })
      .eq("device_code_hash", data.device_code_hash)
      .eq("status", "pending")
    if (result.error) throw result.error
    return json(request, { approved: true })
  })

export const POST = handler
export const OPTIONS = handler
