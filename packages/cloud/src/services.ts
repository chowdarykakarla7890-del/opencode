import Stripe from "stripe"
import { customerFor, priceForPlan, stripeClient, subscriptionFor, syncSubscription } from "./billing.js"
import { adminClient, requireIdentity } from "./database.js"
import { billingEnvironment, environment, managedAIEnabled } from "./env.js"
import {
  estimateRequest,
  finalizeRequest,
  gatewayRequest,
  meteredStream,
  reserveRequest,
  usageFrom,
} from "./managed-ai.js"
import { isPlanID, plans, publicPlan } from "./plans.js"
import { json, methodNotAllowed, options, raw, readObject, run } from "./response.js"

const checkout = (request: Request) =>
  run(request, async () => {
    if (request.method !== "POST") return methodNotAllowed(request)
    const account = await requireIdentity(request)
    if (!account) return json(request, { error: "unauthorized" }, 401)

    const body = await readObject(request)
    if (!isPlanID(body?.plan) || body.plan === "free") return json(request, { error: "invalid_plan" }, 400)
    const current = await subscriptionFor(account.admin, account.user.id)
    if (current.active) return json(request, { error: "subscription_active", plan: current.plan.id }, 409)

    const session = await stripeClient().checkout.sessions.create({
      mode: "subscription",
      customer: await customerFor(account.admin, account.user),
      client_reference_id: account.user.id,
      line_items: [{ price: priceForPlan(body.plan), quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${environment().appUrl}/account?checkout=success`,
      cancel_url: `${environment().appUrl}/account?checkout=cancelled`,
      metadata: { codetutor_user_id: account.user.id, codetutor_plan: body.plan },
      subscription_data: { metadata: { codetutor_user_id: account.user.id, codetutor_plan: body.plan } },
    })
    if (!session.url) return json(request, { error: "checkout_unavailable" }, 503)
    return json(request, { url: session.url })
  })

const portal = (request: Request) =>
  run(request, async () => {
    if (request.method !== "POST") return methodNotAllowed(request)
    const account = await requireIdentity(request)
    if (!account) return json(request, { error: "unauthorized" }, 401)
    const session = await stripeClient().billingPortal.sessions.create({
      customer: await customerFor(account.admin, account.user),
      configuration: billingEnvironment().portalConfiguration,
      return_url: `${environment().appUrl}/account`,
    })
    return json(request, { url: session.url })
  })

const subscriptionEvent = (event: Stripe.Event) => {
  if (event.type === "customer.subscription.created") return event.data.object
  if (event.type === "customer.subscription.updated") return event.data.object
  if (event.type === "customer.subscription.deleted") return event.data.object
  return null
}

const webhook = async (request: Request) => {
  if (request.method !== "POST") return methodNotAllowed(request)
  const signature = request.headers.get("stripe-signature")
  if (!signature) return json(request, { error: "missing_signature" }, 400)
  const event = await stripeClient().webhooks
    .constructEventAsync(await request.text(), signature, billingEnvironment().webhookSecret)
    .catch(() => null)
  if (!event) return json(request, { error: "invalid_signature" }, 400)

  const admin = adminClient()
  const existing = await admin.from("billing_events").select("processed_at").eq("event_id", event.id).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data?.processed_at) return json(request, { received: true, duplicate: true })
  const received = await admin.from("billing_events").upsert(
    { event_id: event.id, event_type: event.type, received_at: new Date().toISOString() },
    { onConflict: "event_id" },
  )
  if (received.error) throw received.error
  const subscription = subscriptionEvent(event)
  if (subscription) await syncSubscription(admin, subscription)
  const processed = await admin
    .from("billing_events")
    .update({ processed_at: new Date().toISOString(), error: null })
    .eq("event_id", event.id)
  if (processed.error) throw processed.error
  return json(request, { received: true })
}

const planList = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET") return methodNotAllowed(request)
    return json(request, { plans: Object.values(plans).map(publicPlan) })
  })

const usage = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET") return methodNotAllowed(request)
    const account = await requireIdentity(request)
    if (!account) return json(request, { error: "unauthorized" }, 401)
    const entitlement = await subscriptionFor(account.admin, account.user.id)
    const period = new Date().toISOString().slice(0, 7) + "-01"
    const result = await account.admin
      .from("managed_ai_usage")
      .select("request_count,input_tokens,output_tokens,cost_nanos,active_requests,updated_at")
      .eq("user_id", account.user.id)
      .eq("period_start", period)
      .maybeSingle()
    if (result.error) throw result.error
    const month = result.data ?? {
      request_count: 0,
      input_tokens: 0,
      output_tokens: 0,
      cost_nanos: 0,
      active_requests: 0,
      updated_at: null,
    }
    return json(request, {
      period_start: period,
      plan: publicPlan(entitlement.plan),
      usage: { ...month, spend_usd: Number(month.cost_nanos) / 1_000_000_000 },
      remaining: {
        requests: Math.max(0, entitlement.plan.monthlyRequests - month.request_count),
        tokens: Math.max(0, entitlement.plan.monthlyTokens - Number(month.input_tokens) - Number(month.output_tokens)),
        spend_usd: Math.max(0, entitlement.plan.monthlySpendNanos - Number(month.cost_nanos)) / 1_000_000_000,
      },
    })
  })

const safeHeaders = (response: Response) => {
  const headers = new Headers({ "cache-control": "no-store" })
  for (const name of ["content-type", "x-vercel-ai-gateway-request-id"]) {
    const value = response.headers.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}

const chat = async (request: Request) => {
  if (request.method !== "POST") return methodNotAllowed(request)
  const account = await requireIdentity(request)
  if (!account) return json(request, { error: { message: "Sign in to CodeTutor", type: "authentication_error" } }, 401)
  if (!managedAIEnabled()) {
    return json(request, { error: { message: "Managed AI is not configured", type: "service_unavailable" } }, 503)
  }
  const entitlement = await subscriptionFor(account.admin, account.user.id)
  if (!entitlement.plan.managedAI) {
    return json(request, { error: { message: "Upgrade to use CodeTutor managed AI", type: "subscription_required" } }, 402)
  }

  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > 2_000_000) {
    return json(request, { error: { message: "Request is too large", type: "invalid_request_error" } }, 413)
  }
  const parsed: unknown = await new Response(text).json().catch(() => null)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return json(request, { error: { message: "Invalid request", type: "invalid_request_error" } }, 400)
  }
  const body = parsed as Record<string, unknown>
  const model = typeof body.model === "string" ? body.model : ""
  if (!entitlement.plan.models.includes(model)) {
    return json(request, { error: { message: "Model is not included in this plan", type: "model_not_allowed" } }, 403)
  }
  if (
    Array.isArray(body.tools) &&
    body.tools.some((tool) => !tool || typeof tool !== "object" || (tool as { type?: unknown }).type !== "function")
  ) {
    return json(request, { error: { message: "Only function tools are supported", type: "invalid_request_error" } }, 400)
  }

  const requestID = crypto.randomUUID()
  const estimate = estimateRequest(body, entitlement.plan, model)
  const reserved = await reserveRequest(account.admin, {
    userID: account.user.id,
    requestID,
    plan: entitlement.plan,
    model,
    tokens: estimate.tokens,
    costNanos: estimate.costNanos,
  })
  if (!reserved.ok) return json(request, { error: { message: reserved.error, type: "quota_exceeded" } }, 429)

  const release = (actual: { input: number; output: number; cached: number }, status: "completed" | "released") =>
    finalizeRequest(account.admin, { userID: account.user.id, requestID, model, usage: actual, status })
  const upstream = await gatewayRequest(request, body, entitlement.plan).catch(async () => {
    await release({ input: 0, output: 0, cached: 0 }, "released")
    return null
  })
  if (!upstream) return json(request, { error: { message: "AI Gateway is unavailable", type: "upstream_error" } }, 502)
  if (!upstream.ok || !upstream.body) {
    await release({ input: 0, output: 0, cached: 0 }, "released")
    return raw(request, upstream.body, { status: upstream.status, headers: safeHeaders(upstream) })
  }

  const fallback = { input: estimate.input, output: estimate.output, cached: 0 }
  if (body.stream === true) {
    return raw(request, meteredStream(upstream.body, fallback, (actual) => release(actual, "completed")), {
      status: upstream.status,
      headers: safeHeaders(upstream),
    })
  }
  const bytes = await upstream.arrayBuffer()
  const value: unknown = await new Response(bytes).json().catch(() => null)
  await release(usageFrom(value) ?? fallback, "completed")
  return raw(request, bytes, { status: upstream.status, headers: safeHeaders(upstream) })
}

export const handleServices = (request: Request) => {
  if (request.method === "OPTIONS") return options(request)
  const route = new URL(request.url).searchParams.get("route")
  if (route === "billing-checkout") return checkout(request)
  if (route === "billing-portal") return portal(request)
  if (route === "billing-webhook") return webhook(request)
  if (route === "plans") return planList(request)
  if (route === "usage") return usage(request)
  if (route === "ai-chat") return chat(request)
  return json(request, { error: "not_found" }, 404)
}
