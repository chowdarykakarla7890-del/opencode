import { requireStepUpUser } from "./database.js"

export const adminRoles = ["support", "billing", "security", "superadmin"] as const
export type AdminRole = (typeof adminRoles)[number]

export const requireAdmin = async (request: Request, allowed: readonly AdminRole[]) => {
  const account = await requireStepUpUser(request)
  if (!account) return null
  const result = await account.admin
    .from("admin_users")
    .select("role,enabled")
    .eq("user_id", account.user.id)
    .maybeSingle()
  if (result.error) throw result.error
  if (!result.data?.enabled || !allowed.includes(result.data.role as AdminRole)) return null
  return { ...account, role: result.data.role as AdminRole }
}
