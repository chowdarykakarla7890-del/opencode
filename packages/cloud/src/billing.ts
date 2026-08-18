import Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { billingEnvironment } from "./env.js"
import { activeSubscriptionStatuses, isPlanID, plans, type PlanID } from "./plans.js"

export const stripeClient = () => new Stripe(billingEnvironment().secretKey)

export const planForPrice = (price: string | null): PlanID => {
  if (!price) return "free"
  const env = billingEnvironment()
  if (price === env.starterPrice) return "starter"
  if (price === env.proPrice) return "pro"
  return "free"
}

export const priceForPlan = (plan: Exclude<PlanID, "free">) => {
  const env = billingEnvironment()
  if (plan === "starter") return env.starterPrice
  return env.proPrice
}

export const subscriptionFor = async (admin: SupabaseClient, userID: string) => {
  const result = await admin
    .from("subscriptions")
    .select("plan,status,current_period_start,current_period_end,cancel_at_period_end,stripe_subscription_id")
    .eq("user_id", userID)
    .maybeSingle()
  if (result.error) throw result.error

  const active = Boolean(result.data && activeSubscriptionStatuses.has(String(result.data.status)))
  const storedPlan: unknown = result.data?.plan
  const plan: PlanID = active && isPlanID(storedPlan) ? storedPlan : "free"
  return { plan: plans[plan], subscription: result.data, active }
}

export const customerFor = async (admin: SupabaseClient, user: { id: string; email?: string }) => {
  const existing = await admin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data.stripe_customer_id as string

  const customer = await stripeClient().customers.create({
    email: user.email,
    metadata: { codetutor_user_id: user.id },
  })
  const stored = await admin.from("billing_customers").insert({
    user_id: user.id,
    stripe_customer_id: customer.id,
  })
  if (stored.error) throw stored.error
  return customer.id
}

export const unixDate = (value: number | null | undefined) =>
  value === null || value === undefined ? null : new Date(value * 1_000).toISOString()

export const syncSubscription = async (admin: SupabaseClient, subscription: Stripe.Subscription) => {
  const userID = subscription.metadata.codetutor_user_id
  if (!userID) throw new Error(`Stripe subscription ${subscription.id} has no CodeTutor user`)

  const item = subscription.items.data[0]
  const priceID = item?.price.id ?? null
  const customerID = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
  const customer = await admin.from("billing_customers").upsert(
    { user_id: userID, stripe_customer_id: customerID, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  )
  if (customer.error) throw customer.error

  const stored = await admin.from("subscriptions").upsert(
    {
      user_id: userID,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceID,
      plan: planForPrice(priceID),
      status: subscription.status,
      current_period_start: unixDate(item?.current_period_start),
      current_period_end: unixDate(item?.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )
  if (stored.error) throw stored.error
}
