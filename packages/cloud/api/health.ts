import { json, methodNotAllowed, run } from "../src/response.js"
import { billingEnabled, managedAIEnabled, syncEnabled } from "../src/env.js"

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET") return methodNotAllowed(request)
    return json(request, {
      name: "codetutor-account",
      status: "ok",
      billing: billingEnabled() ? "enabled" : "disabled",
      managed_ai: managedAIEnabled() ? "enabled" : "disabled",
      sync: syncEnabled() ? "enabled" : "disabled",
    })
  })

export const GET = handler
export const OPTIONS = handler
