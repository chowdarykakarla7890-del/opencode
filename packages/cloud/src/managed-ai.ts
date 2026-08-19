import type { SupabaseClient } from "@supabase/supabase-js"
import { aiGatewayToken } from "./env.js"
import type { Plan } from "./plans.js"
import { fallbackCatalog, type ModelCatalogEntry } from "./catalog.js"

type Usage = {
  input: number
  output: number
  cached: number
  costNanos?: number
}

type ModelRate = {
  inputNanos: number
  outputNanos: number
  cachedInputNanos: number
}

const rate = (model: string | ModelCatalogEntry): ModelRate | null => {
  const info = typeof model === "string" ? fallbackCatalog().find((item) => item.id === model) : model
  if (!info) return null
  return {
    inputNanos: Math.ceil(info.pricing.input * 1_000_000_000),
    outputNanos: Math.ceil(info.pricing.output * 1_000_000_000),
    cachedInputNanos: Math.ceil(info.pricing.cachedInput * 1_000_000_000),
  }
}

const integer = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null

export const usageFrom = (value: unknown): Usage | null => {
  const body = record(value)
  const usage = record(body?.usage)
  if (!usage) return null
  const details = record(usage.prompt_tokens_details) ?? record(usage.input_tokens_details)
  const input = integer(usage.prompt_tokens ?? usage.input_tokens)
  const output = integer(usage.completion_tokens ?? usage.output_tokens)
  const choice = Array.isArray(body?.choices) ? record(body.choices[0]) : null
  const message = record(choice?.message) ?? record(choice?.delta)
  const provider = record(message?.provider_metadata)
  const gateway = record(provider?.gateway)
  const gatewayCost = Number(gateway?.gatewayCost)
  const costNanos = Number.isFinite(gatewayCost) && gatewayCost >= 0 ? Math.ceil(gatewayCost * 1_000_000_000) : undefined
  return {
    input,
    output,
    cached: Math.min(input, integer(details?.cached_tokens)),
    ...(costNanos === undefined ? {} : { costNanos }),
  }
}

export const requestCostNanos = (model: string | ModelCatalogEntry, usage: Usage) => {
  const pricing = rate(model)
  if (pricing && pricing.inputNanos === 0 && pricing.outputNanos === 0 && pricing.cachedInputNanos === 0) return 0
  if (usage.costNanos !== undefined) return usage.costNanos
  if (!pricing) return 0
  return Math.ceil(
    (usage.input - usage.cached) * pricing.inputNanos +
      usage.cached * pricing.cachedInputNanos +
      usage.output * pricing.outputNanos,
  )
}

export const estimateRequest = (body: Record<string, unknown>, plan: Plan, model: string | ModelCatalogEntry) => {
  const requested = integer(body.max_completion_tokens ?? body.max_tokens) || 4_096
  const modelLimit = typeof model === "string" ? Number.MAX_SAFE_INTEGER : model.maxTokens
  const output = Math.min(requested, plan.maxOutputTokens, modelLimit || plan.maxOutputTokens)
  const input = Math.ceil(JSON.stringify(body.messages ?? body.input ?? "").length / 2)
  const pricing = rate(model)
  const free =
    pricing !== null && pricing.inputNanos === 0 && pricing.outputNanos === 0 && pricing.cachedInputNanos === 0
  return {
    input,
    output,
    tokens: input + output,
    costNanos: free
      ? 0
      : Math.ceil(input * (pricing?.inputNanos ?? 0) + output * (pricing?.outputNanos ?? 0) + 250_000),
  }
}

export const costConfirmationRequired = (estimatedCostNanos: number, remainingCostNanos: number) =>
  estimatedCostNanos > 0 && remainingCostNanos > 0 && estimatedCostNanos > remainingCostNanos * 0.1

export const usageWarnings = (used: number, limit: number) => {
  if (limit <= 0) return []
  const ratio = used / limit
  return [0.5, 0.8, 0.95].filter((threshold) => ratio >= threshold)
}

export const gatewayPayload = (
  body: Record<string, unknown>,
  plan: Plan,
  userID: string,
  model?: ModelCatalogEntry,
) => {
  const providerOptions = record(body.providerOptions) ?? {}
  const gateway = record(providerOptions.gateway) ?? {}
  const max = Math.min(integer(body.max_completion_tokens ?? body.max_tokens) || 4_096, plan.maxOutputTokens)
  return {
    ...body,
    max_tokens: max,
    max_completion_tokens: undefined,
    service_tier: undefined,
    tools: model?.mode === "chat_only" ? undefined : body.tools,
    tool_choice: model?.mode === "chat_only" ? undefined : body.tool_choice,
    stream_options: body.stream === true ? { include_usage: true } : undefined,
    providerOptions: {
      ...providerOptions,
      gateway: {
        ...gateway,
        models: body.model === "poolside/laguna-s-2.1-free" ? ["zai/glm-4.6v-flash"] : undefined,
        user: userID,
        tags: ["product:codetutor", `plan:${plan.id}`],
      },
    },
  }
}

export const reserveRequest = async (
  admin: SupabaseClient,
  input: {
    userID: string
    requestID: string
    plan: Plan
    model: string
    period: { start: string; end: string }
    tokens: number
    costNanos: number
  },
) => {
  const result = await admin.rpc("reserve_managed_ai_usage_v2", {
    p_user_id: input.userID,
    p_request_id: input.requestID,
    p_plan: input.plan.id,
    p_model: input.model,
    p_period_start: input.period.start,
    p_period_end: input.period.end,
    p_reserved_tokens: input.tokens,
    p_reserved_cost_nanos: input.costNanos,
    p_request_limit: input.plan.monthlyRequests,
    p_token_limit: input.plan.monthlyTokens,
    p_included_cost_limit_nanos: input.plan.monthlySpendNanos,
    p_rpm_limit: input.plan.requestsPerMinute,
    p_concurrency_limit: input.plan.concurrentRequests,
  })
  if (result.error) throw result.error
  const data = record(result.data)
  return data?.ok === true ? { ok: true as const } : { ok: false as const, error: String(data?.error ?? "quota_error") }
}

export const finalizeRequest = async (
  admin: SupabaseClient,
  input: {
    userID: string
    requestID: string
    usage: Usage
    model: string | ModelCatalogEntry
    status: "completed" | "released"
  },
) => {
  const result = await admin.rpc("finalize_managed_ai_usage_v2", {
    p_user_id: input.userID,
    p_request_id: input.requestID,
    p_input_tokens: input.usage.input,
    p_output_tokens: input.usage.output,
    p_cost_nanos: requestCostNanos(input.model, input.usage),
    p_status: input.status,
  })
  if (result.error) throw result.error
}

export const gatewayRequest = async (
  request: Request,
  body: Record<string, unknown>,
  plan: Plan,
  userID: string,
  model?: ModelCatalogEntry,
) => {
  return fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${aiGatewayToken()}`, "content-type": "application/json" },
    body: JSON.stringify(gatewayPayload(body, plan, userID, model)),
    signal: request.signal,
  })
}

export const meteredStream = (
  stream: ReadableStream<Uint8Array>,
  fallback: Usage,
  complete: (usage: Usage) => Promise<void>,
) => {
  const decoder = new TextDecoder()
  let pending = ""
  let usage: Usage | null = null
  const inspect = (value: string, flush = false) => {
    pending += value
    const lines = pending.split("\n")
    pending = flush ? "" : (lines.pop() ?? "")
    for (const line of lines) {
      const data = line.startsWith("data:") ? line.slice(5).trim() : ""
      if (!data || data === "[DONE]") continue
      const parsed: unknown = JSON.parse(data)
      usage = usageFrom(parsed) ?? usage
    }
  }

  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk)
        inspect(decoder.decode(chunk, { stream: true }))
      },
      async flush() {
        inspect(decoder.decode(), true)
        await complete(usage ?? fallback)
      },
    }),
  )
}
