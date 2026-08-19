import { adminClient } from "../../../src/database.js"
import { supportedClient } from "../../../src/device.js"
import { createAccountSession, accessTokenLifetimeSeconds, rotateAccountSession } from "../../../src/session.js"
import { json, methodNotAllowed, readObject, run } from "../../../src/response.js"
import { tokenHash } from "../../../src/token.js"

const tokenResponse = (request: Request, tokens: { accessToken: string; refreshToken: string }) =>
  json(request, {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: "Bearer",
    expires_in: accessTokenLifetimeSeconds,
  })

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "POST") return methodNotAllowed(request)
    const body = await readObject(request)
    if (!supportedClient(body?.client_id)) return json(request, { error: "invalid_client" }, 400)

    if (body?.grant_type === "refresh_token") {
      const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : ""
      const tokens = refreshToken ? await rotateAccountSession(refreshToken) : null
      if (!tokens) return json(request, { error: "invalid_grant", error_description: "Refresh token is invalid" }, 400)
      return tokenResponse(request, tokens)
    }

    if (body?.grant_type !== "urn:ietf:params:oauth:grant-type:device_code") {
      return json(request, { error: "unsupported_grant_type", error_description: "Grant type is not supported" }, 400)
    }
    const deviceCode = typeof body.device_code === "string" ? body.device_code : ""
    if (!deviceCode) return json(request, { error: "invalid_request", error_description: "Device code is required" }, 400)

    const admin = adminClient()
    const hash = await tokenHash(deviceCode)
    const { data, error } = await admin
      .from("device_authorizations")
      .select("status,user_id,client_id,client_type,device_name,platform,strict_login,expires_at,interval_seconds,last_polled_at")
      .eq("device_code_hash", hash)
      .maybeSingle()
    if (error) throw error
    if (!data || Date.parse(data.expires_at) <= Date.now()) {
      return json(request, { error: "expired_token", error_description: "Device code expired" }, 400)
    }
    if (data.status === "denied") {
      return json(request, { error: "access_denied", error_description: "Authorization denied" }, 400)
    }
    if (data.status === "consumed") {
      return json(request, { error: "expired_token", error_description: "Device code already used" }, 400)
    }
    if (data.status !== "approved" || !data.user_id) {
      const slow = data.last_polled_at && Date.now() - Date.parse(data.last_polled_at) < data.interval_seconds * 1000
      const updated = await admin
        .from("device_authorizations")
        .update({ last_polled_at: new Date().toISOString() })
        .eq("device_code_hash", hash)
      if (updated.error) throw updated.error
      return json(
        request,
        slow
          ? { error: "slow_down", error_description: "Polling too quickly" }
          : { error: "authorization_pending", error_description: "Authorization is pending" },
        400,
      )
    }

    const tokens = await createAccountSession(data.user_id, {
      clientID: data.client_id,
      clientType: data.client_type === "desktop" ? "desktop" : "cli",
      deviceName: data.device_name ?? undefined,
      platform: data.platform ?? undefined,
      strictLogin: data.strict_login,
    })
    const consumed = await admin
      .from("device_authorizations")
      .update({ status: "consumed", consumed_at: new Date().toISOString() })
      .eq("device_code_hash", hash)
      .eq("status", "approved")
    if (consumed.error) throw consumed.error
    return tokenResponse(request, tokens)
  })

export const POST = handler
export const OPTIONS = handler
