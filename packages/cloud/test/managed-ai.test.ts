import { describe, expect, test } from "bun:test"
import { estimateRequest, requestCostNanos, usageFrom } from "../src/managed-ai"
import { plans, publicPlan } from "../src/plans"

describe("managed AI limits", () => {
  test("publishes every monthly limit", () => {
    expect(publicPlan(plans.starter)).toEqual({
      id: "starter",
      name: "Starter",
      price_monthly: 12,
      managed_ai: true,
      limits: {
        requests_monthly: 1_000,
        tokens_monthly: 2_000_000,
        spend_monthly_usd: 5,
        requests_per_minute: 10,
        concurrent_requests: 2,
        max_output_tokens: 8_192,
      },
      models: ["google/gemini-3.1-flash-lite"],
    })
  })

  test("caps output reservations at the plan limit", () => {
    const estimate = estimateRequest(
      { messages: [{ role: "user", content: "teach me" }], max_tokens: 100_000 },
      plans.starter,
      "google/gemini-3.1-flash-lite",
    )
    expect(estimate.output).toBe(8_192)
    expect(estimate.tokens).toBeGreaterThan(8_192)
    expect(estimate.costNanos).toBeGreaterThan(250_000)
  })

  test("reads OpenAI-compatible usage and prices cached input", () => {
    const usage = usageFrom({
      usage: {
        prompt_tokens: 1_000,
        completion_tokens: 200,
        prompt_tokens_details: { cached_tokens: 400 },
      },
    })
    expect(usage).toEqual({ input: 1_000, output: 200, cached: 400 })
    expect(requestCostNanos("openai/gpt-5.4-mini", usage!)).toBe(1_380_000)
  })

  test("rejects malformed usage", () => {
    expect(usageFrom({ usage: null })).toBeNull()
    expect(usageFrom(null)).toBeNull()
  })

  test("uses the measured gateway cost when it is present", () => {
    const usage = usageFrom({
      choices: [{ message: { provider_metadata: { gateway: { gatewayCost: "0.00022775" } } } }],
      usage: { prompt_tokens: 5, completion_tokens: 1 },
    })
    expect(usage?.costNanos).toBe(227_750)
    expect(requestCostNanos("google/gemini-3.1-flash-lite", usage!)).toBe(227_750)
  })
})
