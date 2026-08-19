import { describe, expect, test } from "bun:test"
import {
  costConfirmationRequired,
  estimateRequest,
  gatewayPayload,
  requestCostNanos,
  usageFrom,
  usageWarnings,
} from "../src/managed-ai"
import { plans, publicPlan, unlimitedPlan } from "../src/plans"

describe("managed AI limits", () => {
  test("requires confirmation above ten percent of remaining credit", () => {
    expect(costConfirmationRequired(100_000_001, 1_000_000_000)).toBeTrue()
    expect(costConfirmationRequired(100_000_000, 1_000_000_000)).toBeFalse()
    expect(costConfirmationRequired(0, 1_000_000_000)).toBeFalse()
  })

  test("reports crossed usage warning thresholds", () => {
    expect(usageWarnings(49, 100)).toEqual([])
    expect(usageWarnings(80, 100)).toEqual([0.5, 0.8])
    expect(usageWarnings(96, 100)).toEqual([0.5, 0.8, 0.95])
  })

  test("publishes every monthly limit", () => {
    expect(publicPlan(plans.starter)).toEqual({
      id: "starter",
      name: "Starter",
      price_monthly: 12,
      managed_ai: true,
      model_access: "all_gateway_language",
      limits: {
        requests_monthly: 5_000,
        tokens_monthly: 20_000_000,
        spend_monthly_usd: 6,
        requests_per_minute: 20,
        concurrent_requests: 2,
        max_output_tokens: 32_768,
      },
      models: ["poolside/laguna-s-2.1-free", "google/gemini-3.1-flash-lite", "openai/gpt-5.4-mini"],
    })
    expect(publicPlan(plans.pro).limits.max_output_tokens).toBe(128_000)
  })

  test("caps output reservations at the plan limit", () => {
    const estimate = estimateRequest(
      { messages: [{ role: "user", content: "teach me" }], max_tokens: 100_000 },
      plans.starter,
      "google/gemini-3.1-flash-lite",
    )
    expect(estimate.output).toBe(32_768)
    expect(estimate.tokens).toBeGreaterThan(32_768)
    expect(estimate.costNanos).toBeGreaterThan(250_000)
  })

  test("offers a zero-cost coding model on the free plan", () => {
    expect(publicPlan(plans.free)).toEqual({
      id: "free",
      name: "Free",
      price_monthly: 0,
      managed_ai: true,
      model_access: "all_gateway_language",
      limits: {
        requests_monthly: 250,
        tokens_monthly: 1_000_000,
        spend_monthly_usd: 0.5,
        requests_per_minute: 5,
        concurrent_requests: 1,
        max_output_tokens: 8_192,
      },
      models: ["poolside/laguna-s-2.1-free", "google/gemini-3.1-flash-lite", "openai/gpt-5.4-mini"],
    })
    expect(estimateRequest({ messages: [{ role: "user", content: "teach me" }] }, plans.free, plans.free.models[0]).costNanos).toBe(0)
  })

  test("keeps the private unlimited entitlement out of public checkout plans", () => {
    expect(Object.keys(plans)).toEqual(["free", "starter", "pro"])
    expect(unlimitedPlan.id).toBe("unlimited")
    expect(unlimitedPlan.models).toEqual([
      "poolside/laguna-s-2.1-free",
      "google/gemini-3.1-flash-lite",
      "openai/gpt-5.4-mini",
    ])
    expect(unlimitedPlan.monthlyRequests).toBe(2_147_483_647)
  })

  test("replaces client gateway attribution with CodeTutor-owned values", () => {
    const payload = gatewayPayload(
      {
        messages: [{ role: "user", content: "teach me" }],
        providerOptions: { gateway: { user: "spoofed", tags: ["spoofed"], models: ["other/model"] } },
      },
      plans.free,
      "learner-123",
    )
    expect(payload.providerOptions.gateway).toEqual({
      user: "learner-123",
      tags: ["product:codetutor", "plan:free"],
      models: undefined,
    })
  })

  test("keeps free-model failover available on every plan", () => {
    const payload = gatewayPayload({ model: "poolside/laguna-s-2.1-free" }, plans.pro, "learner-123")
    expect(payload.providerOptions.gateway.models).toEqual(["zai/glm-4.6v-flash"])
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

  test("keeps free models free when gateway metadata includes a cost", () => {
    const usage = usageFrom({
      choices: [{ message: { provider_metadata: { gateway: { gatewayCost: "0.000225" } } } }],
      usage: { prompt_tokens: 5, completion_tokens: 1 },
    })
    expect(usage?.costNanos).toBe(225_000)
    expect(requestCostNanos("poolside/laguna-s-2.1-free", usage!)).toBe(0)
  })
})
