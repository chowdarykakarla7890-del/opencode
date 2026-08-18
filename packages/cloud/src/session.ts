import { randomToken, tokenHash } from "./token.js"
import { adminClient } from "./database.js"

export const accessTokenLifetimeSeconds = 15 * 60
export const refreshTokenLifetimeSeconds = 30 * 24 * 60 * 60

const expiresAt = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString()

export const createAccountSession = async (userID: string) => {
  const admin = adminClient()
  const accessToken = randomToken()
  const refreshToken = randomToken()
  const { data, error } = await admin
    .from("account_sessions")
    .insert({
      user_id: userID,
      access_token_hash: await tokenHash(accessToken),
      refresh_token_hash: await tokenHash(refreshToken),
      access_expires_at: expiresAt(accessTokenLifetimeSeconds),
      refresh_expires_at: expiresAt(refreshTokenLifetimeSeconds),
    })
    .select("id")
    .single()
  if (error) throw error
  return { id: data.id as string, accessToken, refreshToken }
}

export const rotateAccountSession = async (refreshToken: string) => {
  const admin = adminClient()
  const { data, error } = await admin
    .from("account_sessions")
    .select("id,user_id,refresh_expires_at,revoked_at")
    .eq("refresh_token_hash", await tokenHash(refreshToken))
    .maybeSingle()
  if (error) throw error
  if (!data || data.revoked_at || Date.parse(data.refresh_expires_at) <= Date.now()) return null

  const access = randomToken()
  const refresh = randomToken()
  const updated = await admin
    .from("account_sessions")
    .update({
      access_token_hash: await tokenHash(access),
      refresh_token_hash: await tokenHash(refresh),
      access_expires_at: expiresAt(accessTokenLifetimeSeconds),
      refresh_expires_at: expiresAt(refreshTokenLifetimeSeconds),
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .eq("refresh_token_hash", await tokenHash(refreshToken))
    .select("id")
    .maybeSingle()
  if (updated.error) throw updated.error
  if (!updated.data) return null
  return { accessToken: access, refreshToken: refresh }
}
