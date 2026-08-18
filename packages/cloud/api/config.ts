import { subscriptionFor } from "../src/billing.js"
import { requireAccount } from "../src/database.js"
import { bearerToken, json, methodNotAllowed, run } from "../src/response.js"

const models: Record<string, object> = {
  "google/gemini-3.1-flash-lite": {
    id: "google/gemini-3.1-flash-lite",
    name: "CodeTutor Fast",
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    cost: { input: 0.25, output: 1.5, cache_read: 0.03 },
    limit: { context: 1_000_000, output: 65_000 },
  },
  "openai/gpt-5.4-mini": {
    id: "openai/gpt-5.4-mini",
    name: "CodeTutor Mentor",
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    cost: { input: 0.75, output: 4.5, cache_read: 0.075 },
    limit: { context: 400_000, output: 128_000 },
  },
}

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET") return methodNotAllowed(request)
    const account = await requireAccount(request)
    if (!account) return json(request, { error: "unauthorized" }, 401)
    const entitlement = await subscriptionFor(account.admin, account.user.id)
    const token = bearerToken(request)
    if (!entitlement.plan.managedAI || !token) return json(request, { error: "no_remote_config" }, 404)

    const baseURL = `${new URL(request.url).origin}/api/ai/v1`
    return json(request, {
      config: {
        provider: {
          codetutor: {
            name: "CodeTutor Managed AI",
            npm: "@ai-sdk/openai-compatible",
            api: baseURL,
            options: { apiKey: token, baseURL },
            models: Object.fromEntries(entitlement.plan.models.map((id) => [id.endsWith("flash-lite") ? "fast" : "mentor", models[id]])),
          },
        },
      },
    })
  })

export const GET = handler
export const OPTIONS = handler
