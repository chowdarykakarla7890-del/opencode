export const planIDs = ["free", "starter", "pro"] as const

export type PlanID = (typeof planIDs)[number]

export type EntitlementID = PlanID | "unlimited"

export type Plan = {
  id: EntitlementID
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

export const topupPacks = {
  "5": { id: "5", creditNanos: 5_000_000_000, priceCents: 700 },
  "10": { id: "10", creditNanos: 10_000_000_000, priceCents: 1_300 },
  "25": { id: "25", creditNanos: 25_000_000_000, priceCents: 3_200 },
} as const

export type TopupPackID = keyof typeof topupPacks

export const managedModels = [
  "poolside/laguna-s-2.1-free",
  "google/gemini-3.1-flash-lite",
  "openai/gpt-5.4-mini",
] as const

export const plans: Record<PlanID, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    managedAI: true,
    monthlyRequests: 250,
    monthlyTokens: 1_000_000,
    monthlySpendNanos: 500_000_000,
    requestsPerMinute: 5,
    concurrentRequests: 1,
    maxOutputTokens: 8_192,
    models: managedModels,
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 12,
    managedAI: true,
    monthlyRequests: 5_000,
    monthlyTokens: 20_000_000,
    monthlySpendNanos: 6_000_000_000,
    requestsPerMinute: 20,
    concurrentRequests: 2,
    maxOutputTokens: 32_768,
    models: managedModels,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 29,
    managedAI: true,
    monthlyRequests: 20_000,
    monthlyTokens: 100_000_000,
    monthlySpendNanos: 18_000_000_000,
    requestsPerMinute: 60,
    concurrentRequests: 4,
    maxOutputTokens: 128_000,
    models: managedModels,
  },
}

export const unlimitedPlan: Plan = {
  id: "unlimited",
  name: "Unlimited",
  priceMonthly: 0,
  managedAI: true,
  monthlyRequests: 2_147_483_647,
  monthlyTokens: Number.MAX_SAFE_INTEGER,
  monthlySpendNanos: Number.MAX_SAFE_INTEGER,
  requestsPerMinute: 2_147_483_647,
  concurrentRequests: 2_147_483_647,
  maxOutputTokens: 128_000,
  models: managedModels,
}

export const isPlanID = (value: unknown): value is PlanID =>
  typeof value === "string" && planIDs.includes(value as PlanID)

export const activeSubscriptionStatuses = new Set(["active", "trialing"])

export const publicPlan = (plan: Plan, models: readonly string[] = plan.models) => ({
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
  model_access: "all_gateway_language" as const,
  models,
})
