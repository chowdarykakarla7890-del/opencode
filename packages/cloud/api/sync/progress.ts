import { requireAccount } from "../../src/database.js"
import { syncEnabled } from "../../src/env.js"
import { json, methodNotAllowed, readObject, run } from "../../src/response.js"

const statuses = new Set(["not_started", "in_progress", "completed"])

const progressEntry = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (typeof item.lesson_id !== "string" || !item.lesson_id || item.lesson_id.length > 120) return null
  if (typeof item.status !== "string" || !statuses.has(item.status)) return null
  if (!Number.isInteger(item.attempts) || (item.attempts as number) < 0) return null
  if (!Number.isInteger(item.hint_index) || (item.hint_index as number) < 0) return null
  if (typeof item.solution_revealed !== "boolean") return null
  if (item.started_at !== null && typeof item.started_at !== "string") return null
  if (item.completed_at !== null && typeof item.completed_at !== "string") return null
  return {
    lesson_id: item.lesson_id,
    status: item.status,
    attempts: item.attempts,
    hint_index: item.hint_index,
    solution_revealed: item.solution_revealed,
    started_at: item.started_at,
    completed_at: item.completed_at,
  }
}

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET" && request.method !== "POST") return methodNotAllowed(request)
    const account = await requireAccount(request)
    if (!account) return json(request, { error: "unauthorized" }, 401)
    if (!syncEnabled()) return json(request, { error: "sync_disabled" }, 503)

    if (request.method === "GET") {
      const result = await account.admin
        .from("learning_progress")
        .select("lesson_id,status,attempts,hint_index,solution_revealed,started_at,completed_at,updated_at")
        .eq("user_id", account.user.id)
        .order("updated_at", { ascending: true })
      if (result.error) throw result.error
      return json(request, { progress: result.data })
    }

    const body = await readObject(request)
    const raw = Array.isArray(body?.progress) ? body.progress : null
    if (!raw || raw.length > 100) return json(request, { error: "invalid_progress" }, 400)
    const progress = raw.map(progressEntry)
    if (progress.some((item) => !item)) return json(request, { error: "invalid_progress" }, 400)
    if (progress.length === 0) return json(request, { progress: [] })

    const updatedAt = new Date().toISOString()
    const result = await account.admin.from("learning_progress").upsert(
      progress.map((item) => ({ ...item, user_id: account.user.id, updated_at: updatedAt })),
      { onConflict: "user_id,lesson_id" },
    )
    if (result.error) throw result.error
    return json(request, { accepted: progress.length, updated_at: updatedAt })
  })

export const GET = handler
export const POST = handler
export const OPTIONS = handler
