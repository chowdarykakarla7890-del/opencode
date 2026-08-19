import Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { billingEnvironment } from "./env.js"
import {
  activeSubscriptionStatuses,
  isPlanID,
  plans,
  topupPacks,
  unlimitedPlan,
  type PlanID,
  type TopupPackID,
} from "./plans.js"

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

export const isTopupPackID = (value: unknown): value is TopupPackID =>
  typeof value === "string" && value in topupPacks

export const priceForTopup = (pack: TopupPackID) => {
  const env = billingEnvironment()
  const price = pack === "5" ? env.topup5Price : pack === "10" ? env.topup10Price : env.topup25Price
  if (!price) throw new Error(`Stripe top-up ${pack} price is not configured`)
  return price
}

export const subscriptionFor = async (admin: SupabaseClient, userID: string) => {
  const [result, override] = await Promise.all([
    admin
      .from("subscriptions")
      .select("plan,status,current_period_start,current_period_end,cancel_at_period_end,stripe_subscription_id")
      .eq("user_id", userID)
      .maybeSingle(),
    admin.from("managed_ai_overrides").select("unlimited").eq("user_id", userID).maybeSingle(),
  ])
  if (result.error) throw result.error
  if (override.error) throw override.error
  if (override.data?.unlimited === true) {
    return { plan: unlimitedPlan, subscription: result.data, active: true }
  }

  const active = Boolean(result.data && activeSubscriptionStatuses.has(String(result.data.status)))
  const storedPlan: unknown = result.data?.plan
  const plan: PlanID = active && isPlanID(storedPlan) ? storedPlan : "free"
  return { plan: plans[plan], subscription: result.data, active }
}

export const usagePeriod = (entitlement: Awaited<ReturnType<typeof subscriptionFor>>) => {
  const start = entitlement.active ? entitlement.subscription?.current_period_start : null
  const end = entitlement.active ? entitlement.subscription?.current_period_end : null
  if (start && end) return { start: String(start).slice(0, 10), end: String(end).slice(0, 10) }
  const now = new Date()
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return { start: periodStart.toISOString().slice(0, 10), end: periodEnd.toISOString().slice(0, 10) }
}

export const creditBalance = async (admin: SupabaseClient, userID: string) => {
  const result = await admin
    .from("managed_ai_credit_grants")
    .select("remaining_nanos,expires_at")
    .eq("user_id", userID)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
  if (result.error) throw result.error
  return {
    remainingNanos: (result.data ?? []).reduce(
      (sum: number, item: { remaining_nanos: number | string }) => sum + Number(item.remaining_nanos),
      0,
    ),
    expiresAt:
      (result.data ?? []).map((item: { expires_at: string }) => String(item.expires_at)).sort()[0] ?? null,
  }
}

export const grantTopup = async (admin: SupabaseClient, session: Stripe.Checkout.Session) => {
  const userID = session.metadata?.codetutor_user_id
  const packID = session.metadata?.codetutor_topup_pack
  if (!userID || !isTopupPackID(packID) || session.payment_status !== "paid") return
  const pack = topupPacks[packID]
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id
  const stored = await admin.from("managed_ai_credit_grants").upsert(
    {
      id: crypto.randomUUID(),
      user_id: userID,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntent ?? null,
      pack_id: packID,
      original_nanos: pack.creditNanos,
      remaining_nanos: pack.creditNanos,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1_000).toISOString(),
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true },
  )
  if (stored.error) throw stored.error
}

export const revokeTopup = async (
  admin: SupabaseClient,
  paymentIntent: string,
  status: "refunded" | "disputed",
) => {
  const result = await admin
    .from("managed_ai_credit_grants")
    .update({ remaining_nanos: 0, status, updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", paymentIntent)
  if (result.error) throw result.error
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
