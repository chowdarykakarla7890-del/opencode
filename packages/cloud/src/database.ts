import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { environment } from "./env.js"
import { bearerToken } from "./response.js"
import { tokenHash } from "./token.js"

export const adminClient = () => {
  const env = environment()
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
}

type AccountUser = {
  id: string
  email?: string
  last_sign_in_at?: string
  user_metadata?: Record<string, unknown>
}

const authClient = (admin: SupabaseClient) =>
  admin.auth as unknown as {
    admin: {
      getUserById: (id: string) => Promise<{ data: { user: AccountUser | null }; error: unknown }>
    }
    getUser: (token: string) => Promise<{ data: { user: AccountUser | null }; error: unknown }>
  }

export const requireAccount = async (request: Request) => {
  const token = bearerToken(request)
  if (!token) return null

  const admin = adminClient()
  const { data, error } = await admin
    .from("account_sessions")
    .select("id,user_id,access_expires_at,idle_expires_at,absolute_expires_at,revoked_at")
    .eq("access_token_hash", await tokenHash(token))
    .maybeSingle()
  if (error) throw error
  if (
    !data ||
    data.revoked_at ||
    Date.parse(data.access_expires_at) <= Date.now() ||
    (data.idle_expires_at && Date.parse(data.idle_expires_at) <= Date.now()) ||
    (data.absolute_expires_at && Date.parse(data.absolute_expires_at) <= Date.now())
  )
    return null

  const result = await authClient(admin).admin.getUserById(data.user_id)
  if (result.error) throw result.error
  if (!result.data.user) return null
  const active = await accountActive(admin, result.data.user.id)
  if (!active) return null
  const seen = await admin.from("account_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id)
  if (seen.error) throw seen.error
  return { admin, kind: "account" as const, sessionID: data.id as string, user: result.data.user }
}

export const requireSupabaseUser = async (request: Request, includeDeleted = false) => {
  const token = bearerToken(request)
  if (!token) return null
  const admin = adminClient()
  const result = await authClient(admin).getUser(token)
  if (result.error || !result.data.user) return null
  if (!includeDeleted && !(await accountActive(admin, result.data.user.id))) return null
  return { admin, kind: "supabase" as const, user: result.data.user }
}

export const requireIdentity = async (request: Request) => {
  const account = await requireAccount(request)
  if (account) return account
  return requireSupabaseUser(request)
}

export const requireRecentSupabaseUser = async (
  request: Request,
  maximumAgeSeconds = 10 * 60,
  includeDeleted = false,
) => {
  const account = await requireSupabaseUser(request, includeDeleted)
  if (!account?.user.last_sign_in_at) return null
  if (Date.now() - Date.parse(account.user.last_sign_in_at) > maximumAgeSeconds * 1000) return null
  return account
}

export const requireStepUpUser = async (request: Request, includeDeleted = false) => {
  const account = await requireRecentSupabaseUser(request, 10 * 60, includeDeleted)
  if (!account) return null
  const factors = await account.admin.auth.admin.mfa.listFactors({ userId: account.user.id })
  if (factors.error) throw factors.error
  if (!factors.data.factors.some((factor) => factor.status === "verified")) return account
  const token = bearerToken(request)
  const payload = token?.split(".")[1]
  if (!payload) return null
  const claims: unknown = await new Response(Buffer.from(payload, "base64url")).json().catch(() => null)
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) return null
  return (claims as Record<string, unknown>).aal === "aal2" ? account : null
}

export const requireServiceKey = async (request: Request) => {
  const token = bearerToken(request)
  if (!token?.startsWith("ctsk_")) return null
  const admin = adminClient()
  const { data, error } = await admin
    .from("service_keys")
    .select("id,user_id,scopes,model_allowlist,request_limit,credit_limit_nanos,expires_at,revoked_at")
    .eq("token_hash", await tokenHash(token))
    .maybeSingle()
  if (error) throw error
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) return null
  if (!(await accountActive(admin, data.user_id))) return null
  const result = await authClient(admin).admin.getUserById(data.user_id)
  if (result.error) throw result.error
  if (!result.data.user) return null
  return {
    admin,
    kind: "service_key" as const,
    serviceKey: {
      id: data.id as string,
      scopes: data.scopes as string[],
      modelAllowlist: data.model_allowlist as string[],
    },
    user: result.data.user,
  }
}

const accountActive = async (admin: SupabaseClient, userID: string) => {
  const { data, error } = await admin.from("profiles").select("deleted_at").eq("user_id", userID).maybeSingle()
  if (error) throw error
  return !data?.deleted_at
}
