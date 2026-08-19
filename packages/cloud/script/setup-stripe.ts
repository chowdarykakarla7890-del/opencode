import Stripe from "stripe"

const secret = process.env.STRIPE_SECRET_KEY?.trim()
if (!secret?.startsWith("sk_test_")) throw new Error("Stripe sandbox setup requires an sk_test_ key")

const stripe = new Stripe(secret)

const monthlyPrice = async (input: { lookup: string; name: string; amount: number; plan: string }) => {
  const existing = await stripe.prices.list({ active: true, lookup_keys: [input.lookup], limit: 1 })
  if (existing.data[0]) return existing.data[0]

  const product = await stripe.products.create({
    name: input.name,
    description: `${input.name} monthly CodeTutor subscription`,
    metadata: { codetutor_plan: input.plan },
  })
  return stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: input.amount,
    recurring: { interval: "month" },
    lookup_key: input.lookup,
    metadata: { codetutor_plan: input.plan },
  })
}

const oneTimePrice = async (input: { lookup: string; name: string; amount: number; pack: string }) => {
  const existing = await stripe.prices.list({ active: true, lookup_keys: [input.lookup], limit: 1 })
  if (existing.data[0]) return existing.data[0]
  const product = await stripe.products.create({
    name: input.name,
    description: `${input.pack} USD of prepaid CodeTutor managed-AI credit`,
    metadata: { codetutor_topup_pack: input.pack },
  })
  return stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: input.amount,
    lookup_key: input.lookup,
    metadata: { codetutor_topup_pack: input.pack },
  })
}

const starter = await monthlyPrice({
  lookup: "codetutor_starter_monthly",
  name: "CodeTutor Starter",
  amount: 1_200,
  plan: "starter",
})
const pro = await monthlyPrice({
  lookup: "codetutor_pro_monthly",
  name: "CodeTutor Pro",
  amount: 2_900,
  plan: "pro",
})
const topup5 = await oneTimePrice({ lookup: "codetutor_topup_5", name: "CodeTutor $5 AI credit", amount: 700, pack: "5" })
const topup10 = await oneTimePrice({
  lookup: "codetutor_topup_10",
  name: "CodeTutor $10 AI credit",
  amount: 1_300,
  pack: "10",
})
const topup25 = await oneTimePrice({
  lookup: "codetutor_topup_25",
  name: "CodeTutor $25 AI credit",
  amount: 3_200,
  pack: "25",
})

const productID = (price: Stripe.Price) => (typeof price.product === "string" ? price.product : price.product.id)
const configurations = await stripe.billingPortal.configurations.list({ limit: 100 })
const portal =
  configurations.data.find((item) => item.active && item.metadata.codetutor === "1") ??
  (await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Manage your CodeTutor subscription" },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "address"] },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        products: [
          { product: productID(starter), prices: [starter.id] },
          { product: productID(pro), prices: [pro.id] },
        ],
      },
    },
    metadata: { codetutor: "1" },
  }))

const webhookURL = "https://codetutor-cloud.vercel.app/api/billing/webhook"
const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
const existingEndpoint = endpoints.data.find((item) => item.url === webhookURL && item.status === "enabled")
const enabledEvents: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "checkout.session.completed",
  "charge.refunded",
  "charge.dispute.created",
]
const webhook =
  existingEndpoint
    ? await stripe.webhookEndpoints.update(existingEndpoint.id, { enabled_events: enabledEvents })
    : await stripe.webhookEndpoints.create({
        url: webhookURL,
        description: "CodeTutor subscription and credit state",
        enabled_events: enabledEvents,
      })

console.log(
  JSON.stringify({
    starterPrice: starter.id,
    proPrice: pro.id,
    topup5Price: topup5.id,
    topup10Price: topup10.id,
    topup25Price: topup25.id,
    portalConfiguration: portal.id,
    webhookEndpoint: webhook.id,
    webhookSecret: existingEndpoint ? null : webhook.secret,
  }),
)
