import { adminClient } from "./database.js"
import { randomToken, randomUserCode, tokenHash } from "./token.js"

export const deviceLifetimeSeconds = 10 * 60
export const devicePollIntervalSeconds = 5
export const supportedClient = (value: unknown) => value === "codetutor-cli" || value === "opencode-cli"

export const createDeviceAuthorization = async () => {
  const admin = adminClient()
  const deviceCode = randomToken()
  const userCode = randomUserCode()
  const expiresAt = new Date(Date.now() + deviceLifetimeSeconds * 1000).toISOString()
  const { error } = await admin.from("device_authorizations").insert({
    device_code_hash: await tokenHash(deviceCode),
    user_code_hash: await tokenHash(userCode.toUpperCase()),
    client_id: "codetutor-cli",
    status: "pending",
    expires_at: expiresAt,
    interval_seconds: devicePollIntervalSeconds,
  })
  if (error) throw error

  return {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri_complete: `/device?user_code=${encodeURIComponent(userCode)}`,
    expires_in: deviceLifetimeSeconds,
    interval: devicePollIntervalSeconds,
  }
}
