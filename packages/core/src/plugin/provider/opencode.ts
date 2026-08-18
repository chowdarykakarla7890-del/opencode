import { Effect } from "effect"
import { define } from "@opencode-ai/plugin/v2/effect/plugin"
import { ProviderV2 } from "../../provider"

/**
 * OpenCode Zen is retained as an explicitly third-party model provider.
 *
 * CodeTutor deliberately does not expose the upstream OpenCode account,
 * organization, remote configuration, sharing, billing, or enterprise flows.
 * The provider keeps its official ID and OPENCODE_API_KEY for compatibility.
 */
export const OpencodePlugin = define({
  id: "opencode",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.integration.transform((draft) => {
      draft.update("opencode", (integration) => {
        integration.name = "OpenCode Zen (third-party)"
      })
      draft.method.update({
        integrationID: "opencode",
        method: { type: "key", label: "OpenCode Zen API key" },
      })
    })

    yield* ctx.catalog.transform((catalog) => {
      const item = catalog.provider.get(ProviderV2.ID.opencode)
      if (!item) return

      const apiKey = process.env.OPENCODE_API_KEY || item.provider.request.body.apiKey
      catalog.provider.update(item.provider.id, (provider) => {
        provider.name = "OpenCode Zen (third-party)"
        provider.request.body.apiKey = apiKey || "public"
      })

      if (apiKey) return
      for (const model of item.models.values()) {
        if (!model.cost.some((cost) => cost.input > 0)) continue
        catalog.model.update(item.provider.id, model.id, (draft) => {
          draft.enabled = false
        })
      }
    })
  }),
})
