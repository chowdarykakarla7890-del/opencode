import { requireAccount } from "../src/database.js"
import { json, methodNotAllowed, run } from "../src/response.js"

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET") return methodNotAllowed(request)
    if (!(await requireAccount(request))) return json(request, { error: "unauthorized" }, 401)
    return json(request, [])
  })

export const GET = handler
export const OPTIONS = handler
