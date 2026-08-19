import { modelCatalog } from "../src/catalog.js"
import { json, methodNotAllowed, run } from "../src/response.js"

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET") return methodNotAllowed(request)
    const models = await modelCatalog()
    const response = json(request, {
      updated_at: new Date().toISOString(),
      models: models.map((model) => ({
        id: model.id,
        name: model.name,
        owner: model.owner,
        description: model.description,
        type: model.type,
        mode: model.mode,
        selectable: model.selectable,
        disabled_reason: model.disabledReason,
        reasoning: model.reasoning,
        tool_call: model.toolCall,
        modalities: model.modalities,
        context_window: model.contextWindow,
        max_output_tokens: model.maxTokens,
        pricing: model.pricing,
        tags: model.tags,
        release_date: model.releaseDate,
      })),
    })
    response.headers.set("cache-control", "public, s-maxage=21600, stale-while-revalidate=86400")
    return response
  })

export const GET = handler
export const OPTIONS = handler
