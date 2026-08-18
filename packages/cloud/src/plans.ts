export const planIDs = ["free", "starter", "pro"] as const

export type PlanID = (typeof planIDs)[number]

export type Plan = {
  id: PlanID
  name: string
  priceMonthly: number
  managedAI: boolean
  monthlyRequests: number
  monthlyTokens: number
  monthlySpendNanos: number
  requestsPerMinute: number
  concurrentRequests: number
  maxOutputTokens: number
  models: readonly string[]
}

export const plans: Record<PlanID, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    managedAI: false,
    monthlyRequests: 0,
    monthlyTokens: 0,
    monthlySpendNanos: 0,
    requestsPerMinute: 0,
    concurrentRequests: 0,
    maxOutputTokens: 0,
    models: [],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 12,
    managedAI: true,
    monthlyRequests: 1_000,
    monthlyTokens: 2_000_000,
    monthlySpendNanos: 5_000_000_000,
    requestsPerMinute: 10,
    concurrentRequests: 2,
    maxOutputTokens: 8_192,
    models: ["google/gemini-3.1-flash-lite"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 29,
    managedAI: true,
    monthlyRequests: 4_000,
    monthlyTokens: 8_000_000,
    monthlySpendNanos: 15_000_000_000,
    requestsPerMinute: 30,
    concurrentRequests: 4,
    maxOutputTokens: 16_384,
    models: ["google/gemini-3.1-flash-lite", "openai/gpt-5.4-mini"],
  },
}

export const isPlanID = (value: unknown): value is PlanID =>
  typeof value === "string" && planIDs.includes(value as PlanID)

export const activeSubscriptionStatuses = new Set(["active", "trialing"])

export const publicPlan = (plan: Plan) => ({
  id: plan.id,
  name: plan.name,
  price_monthly: plan.priceMonthly,
  managed_ai: plan.managedAI,
  limits: {
    requests_monthly: plan.monthlyRequests,
    tokens_monthly: plan.monthlyTokens,
    spend_monthly_usd: plan.monthlySpendNanos / 1_000_000_000,
    requests_per_minute: plan.requestsPerMinute,
    concurrent_requests: plan.concurrentRequests,
    max_output_tokens: plan.maxOutputTokens,
  },
  models: plan.models,
})
