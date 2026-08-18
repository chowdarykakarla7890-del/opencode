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

type AccountUser = { id: string; email?: string }

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
    .select("id,user_id,access_expires_at,revoked_at")
    .eq("access_token_hash", await tokenHash(token))
    .maybeSingle()
  if (error) throw error
  if (!data || data.revoked_at || Date.parse(data.access_expires_at) <= Date.now()) return null

  const result = await authClient(admin).admin.getUserById(data.user_id)
  if (result.error) throw result.error
  if (!result.data.user) return null
  return { admin, sessionID: data.id as string, user: result.data.user }
}

export const requireSupabaseUser = async (request: Request) => {
  const token = bearerToken(request)
  if (!token) return null
  const admin = adminClient()
  const result = await authClient(admin).getUser(token)
  if (result.error || !result.data.user) return null
  return { admin, user: result.data.user }
}

export const requireIdentity = async (request: Request) => {
  const account = await requireAccount(request)
  if (account) return account
  return requireSupabaseUser(request)
}
