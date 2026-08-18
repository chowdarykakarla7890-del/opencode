import { environment } from "../src/env.js"
import { methodNotAllowed, run } from "../src/response.js"

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET") return methodNotAllowed(request)
    const source = new URL(request.url)
    const target = new URL("/device", environment().appUrl)
    const userCode = source.searchParams.get("user_code")
    if (userCode) target.searchParams.set("user_code", userCode)
    return Response.redirect(target, 302)
  })

export const GET = handler
export const OPTIONS = handler
