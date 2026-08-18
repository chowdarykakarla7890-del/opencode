import { requireAccount } from "../src/database.js"
import { json, methodNotAllowed, run } from "../src/response.js"

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET") return methodNotAllowed(request)
    const account = await requireAccount(request)
    if (!account) return json(request, { error: "unauthorized" }, 401)
    return json(request, { id: account.user.id, email: account.user.email ?? "" })
  })

export const GET = handler
export const OPTIONS = handler
