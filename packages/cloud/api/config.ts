import { subscriptionFor } from "../src/billing.js"
import { requireAccount } from "../src/database.js"
import { bearerToken, json, methodNotAllowed, run } from "../src/response.js"
import type { Plan } from "../src/plans.js"
import { fallbackCatalog, modelCatalog, type ModelCatalogEntry } from "../src/catalog.js"

const compatibility = {
  free: "poolside/laguna-s-2.1-free",
  fast: "google/gemini-3.1-flash-lite",
  mentor: "openai/gpt-5.4-mini",
} as const

const configModel = (model: ModelCatalogEntry) => ({
  id: model.id,
  name: model.name,
  family: model.owner,
  release_date: model.releaseDate,
  status: "active",
  reasoning: model.reasoning,
  tool_call: model.toolCall,
  attachment: model.modalities.input.some((item) => item !== "text"),
  modalities: model.modalities,
  cost: {
    input: model.pricing.input * 1_000_000,
    output: model.pricing.output * 1_000_000,
    cache_read: model.pricing.cachedInput * 1_000_000,
  },
  limit: {
    context: model.contextWindow,
    output: model.selectable ? model.maxTokens : 0,
  },
})

export const managedConfig = (
  plan: Plan,
  token: string,
  origin: string,
  catalog: readonly ModelCatalogEntry[] = fallbackCatalog(),
) => {
  const baseURL = `${origin}/api/ai/v1`
  const models = Object.fromEntries(catalog.map((model) => [model.id, configModel(model)]))
  for (const [alias, id] of Object.entries(compatibility)) {
    const model = catalog.find((item) => item.id === id)
    if (model) models[alias] = { ...configModel(model), status: "deprecated" }
  }
  return {
    small_model: "codetutor/poolside/laguna-s-2.1-free",
    provider: {
      codetutor: {
        name: "CodeTutor",
        npm: "@ai-sdk/openai-compatible",
        api: baseURL,
        options: { apiKey: token, baseURL },
        models,
      },
    },
  }
}

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET") return methodNotAllowed(request)
    const account = await requireAccount(request)
    if (!account) return json(request, { error: "unauthorized" }, 401)
    const entitlement = await subscriptionFor(account.admin, account.user.id)
    const token = bearerToken(request)
    if (!entitlement.plan.managedAI || !token) return json(request, { error: "no_remote_config" }, 404)

    return json(request, {
      config: managedConfig(entitlement.plan, token, new URL(request.url).origin, await modelCatalog()),
    })
  })

export const GET = handler
export const OPTIONS = handler
