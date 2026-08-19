import Stripe from "stripe"
import {
  creditBalance,
  customerFor,
  grantTopup,
  isTopupPackID,
  priceForPlan,
  priceForTopup,
  revokeTopup,
  stripeClient,
  subscriptionFor,
  syncSubscription,
  usagePeriod,
} from "./billing.js"
import { adminClient, requireIdentity, requireServiceKey, requireStepUpUser } from "./database.js"
import { billingEnvironment, environment, managedAIEnabled, topupsEnabled } from "./env.js"
import {
  costConfirmationRequired,
  estimateRequest,
  finalizeRequest,
  gatewayRequest,
  meteredStream,
  requestCostNanos,
  reserveRequest,
  usageFrom,
  usageWarnings,
} from "./managed-ai.js"
import { isPlanID, plans, publicPlan } from "./plans.js"
import { json, methodNotAllowed, options, raw, readObject, run } from "./response.js"
import { modelByID, modelCatalog, selectableModelIDs } from "./catalog.js"
import { finalizeServiceKey, reserveServiceKey } from "./service-key.js"

const legacyModels: Record<string, string> = {
  free: "poolside/laguna-s-2.1-free",
  fast: "google/gemini-3.1-flash-lite",
  mentor: "openai/gpt-5.4-mini",
}

const checkout = (request: Request) =>
  run(request, async () => {
    if (request.method !== "POST") return methodNotAllowed(request)
    const account = await requireStepUpUser(request)
    if (!account) return json(request, { error: "reauthentication_required" }, 401)

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
      automatic_tax: { enabled: true },
      consent_collection: { terms_of_service: "required" },
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
    const account = await requireStepUpUser(request)
    if (!account) return json(request, { error: "reauthentication_required" }, 401)
    const session = await stripeClient().billingPortal.sessions.create({
      customer: await customerFor(account.admin, account.user),
      configuration: billingEnvironment().portalConfiguration,
      return_url: `${environment().appUrl}/account`,
    })
    return json(request, { url: session.url })
  })

const topup = (request: Request) =>
  run(request, async () => {
    if (request.method !== "POST") return methodNotAllowed(request)
    const account = await requireStepUpUser(request)
    if (!account) return json(request, { error: "reauthentication_required" }, 401)
    if (!topupsEnabled()) return json(request, { error: "topups_unavailable" }, 503)
    const body = await readObject(request)
    if (!isTopupPackID(body?.pack)) return json(request, { error: "invalid_topup_pack" }, 400)
    const entitlement = await subscriptionFor(account.admin, account.user.id)
    if (!entitlement.active || entitlement.plan.id === "free") {
      return json(request, { error: "paid_subscription_required" }, 402)
    }
    const session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      customer: await customerFor(account.admin, account.user),
      client_reference_id: account.user.id,
      line_items: [{ price: priceForTopup(body.pack), quantity: 1 }],
      automatic_tax: { enabled: true },
      consent_collection: { terms_of_service: "required" },
      success_url: `${environment().appUrl}/account?topup=success`,
      cancel_url: `${environment().appUrl}/account?topup=cancelled`,
      metadata: { codetutor_user_id: account.user.id, codetutor_topup_pack: body.pack },
      payment_intent_data: { metadata: { codetutor_user_id: account.user.id, codetutor_topup_pack: body.pack } },
    })
    if (!session.url) return json(request, { error: "checkout_unavailable" }, 503)
    return json(request, { url: session.url })
  })

const changePlan = (request: Request) =>
  run(request, async () => {
    if (request.method !== "POST") return methodNotAllowed(request)
    const account = await requireStepUpUser(request)
    if (!account) return json(request, { error: "reauthentication_required" }, 401)
    const body = await readObject(request)
    if (!isPlanID(body?.plan)) return json(request, { error: "invalid_plan" }, 400)
    const entitlement = await subscriptionFor(account.admin, account.user.id)
    if (entitlement.plan.id === body.plan) return json(request, { error: "plan_unchanged" }, 409)
    if (!entitlement.active && body.plan !== "free") {
      const session = await stripeClient().checkout.sessions.create({
        mode: "subscription",
        customer: await customerFor(account.admin, account.user),
        client_reference_id: account.user.id,
        line_items: [{ price: priceForPlan(body.plan), quantity: 1 }],
        allow_promotion_codes: true,
        automatic_tax: { enabled: true },
        consent_collection: { terms_of_service: "required" },
        success_url: `${environment().appUrl}/account?checkout=success`,
        cancel_url: `${environment().appUrl}/account?checkout=cancelled`,
        metadata: { codetutor_user_id: account.user.id, codetutor_plan: body.plan },
        subscription_data: { metadata: { codetutor_user_id: account.user.id, codetutor_plan: body.plan } },
      })
      if (!session.url) return json(request, { error: "checkout_unavailable" }, 503)
      return json(request, { url: session.url })
    }
    const subscriptionID = entitlement.subscription?.stripe_subscription_id
    if (!subscriptionID) return json(request, { error: "subscription_not_found" }, 404)
    const stripe = stripeClient()
    if (body.plan === "free") {
      await stripe.subscriptions.update(subscriptionID, { cancel_at_period_end: true })
      return json(request, { url: `${environment().appUrl}/account?plan=cancelled` })
    }
    const subscription = await stripe.subscriptions.retrieve(subscriptionID)
    const item = subscription.items.data[0]
    if (!item) return json(request, { error: "subscription_item_not_found" }, 409)
    if (entitlement.plan.id === "starter" && body.plan === "pro") {
      await stripe.subscriptions.update(subscriptionID, {
        items: [{ id: item.id, price: priceForPlan(body.plan) }],
        proration_behavior: "always_invoice",
        metadata: { ...subscription.metadata, codetutor_user_id: account.user.id, codetutor_plan: body.plan },
      })
      return json(request, { url: `${environment().appUrl}/account?plan=upgraded` })
    }
    const existingSchedule =
      typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule?.id
    const schedule = existingSchedule
      ? await stripe.subscriptionSchedules.retrieve(existingSchedule)
      : await stripe.subscriptionSchedules.create({ from_subscription: subscriptionID })
    const current = schedule.current_phase
    if (!current) return json(request, { error: "subscription_phase_not_found" }, 409)
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          start_date: current.start_date,
          end_date: current.end_date,
          items: [{ price: item.price.id, quantity: item.quantity ?? 1 }],
          proration_behavior: "none",
        },
        {
          start_date: current.end_date,
          items: [{ price: priceForPlan(body.plan), quantity: 1 }],
          metadata: { codetutor_user_id: account.user.id, codetutor_plan: body.plan },
          proration_behavior: "none",
        },
      ],
    })
    return json(request, { url: `${environment().appUrl}/account?plan=scheduled` })
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
  if (event.type === "checkout.session.completed") await grantTopup(admin, event.data.object)
  if (event.type === "charge.refunded" && typeof event.data.object.payment_intent === "string") {
    await revokeTopup(admin, event.data.object.payment_intent, "refunded")
  }
  if (event.type === "charge.dispute.created" && typeof event.data.object.payment_intent === "string") {
    await revokeTopup(admin, event.data.object.payment_intent, "disputed")
  }
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
    const models = selectableModelIDs(await modelCatalog())
    return json(request, { plans: Object.values(plans).map((plan) => publicPlan(plan, models)) })
  })

const usage = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET") return methodNotAllowed(request)
    const account = await requireIdentity(request)
    if (!account) return json(request, { error: "unauthorized" }, 401)
    const entitlement = await subscriptionFor(account.admin, account.user.id)
    const period = usagePeriod(entitlement)
    const result = await account.admin
      .from("managed_ai_usage")
      .select("request_count,input_tokens,output_tokens,cost_nanos,included_cost_nanos,topup_cost_nanos,active_requests,updated_at")
      .eq("user_id", account.user.id)
      .eq("period_start", period.start)
      .maybeSingle()
    if (result.error) throw result.error
    const month = result.data ?? {
      request_count: 0,
      input_tokens: 0,
      output_tokens: 0,
      cost_nanos: 0,
      included_cost_nanos: 0,
      topup_cost_nanos: 0,
      active_requests: 0,
      updated_at: null,
    }
    return json(request, {
      period_start: period.start,
      period_end: period.end,
      plan: publicPlan(entitlement.plan),
      usage: { ...month, spend_usd: Number(month.cost_nanos) / 1_000_000_000 },
      credit: await creditBalance(account.admin, account.user.id),
      remaining: {
        requests: Math.max(0, entitlement.plan.monthlyRequests - month.request_count),
        tokens: Math.max(0, entitlement.plan.monthlyTokens - Number(month.input_tokens) - Number(month.output_tokens)),
        spend_usd:
          Math.max(0, entitlement.plan.monthlySpendNanos - Number(month.included_cost_nanos)) / 1_000_000_000,
      },
      warnings: {
        requests: usageWarnings(month.request_count, entitlement.plan.monthlyRequests),
        tokens: usageWarnings(Number(month.input_tokens) + Number(month.output_tokens), entitlement.plan.monthlyTokens),
        credit: usageWarnings(Number(month.included_cost_nanos), entitlement.plan.monthlySpendNanos),
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
  const account = (await requireIdentity(request)) ?? (await requireServiceKey(request))
  if (!account) return json(request, { error: { message: "Sign in to CodeTutor", type: "authentication_error" } }, 401)
  if (!managedAIEnabled()) {
    return json(request, { error: { message: "Managed AI is not configured", type: "service_unavailable" } }, 503)
  }
  const entitlement = await subscriptionFor(account.admin, account.user.id)
  const period = usagePeriod(entitlement)
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
  const requested = typeof (parsed as Record<string, unknown>).model === "string" ? String((parsed as Record<string, unknown>).model) : ""
  const modelID = legacyModels[requested] ?? requested
  const body: Record<string, unknown> = { ...(parsed as Record<string, unknown>), model: modelID }
  const model = modelByID(await modelCatalog(), modelID)
  if (!model?.selectable) {
    return json(request, {
      error: { message: model?.disabledReason ?? "Model is not available", type: "model_not_allowed" },
    }, 403)
  }
  if (
    Array.isArray(body.tools) &&
    body.tools.some((tool) => !tool || typeof tool !== "object" || (tool as { type?: unknown }).type !== "function")
  ) {
    return json(request, { error: { message: "Only function tools are supported", type: "invalid_request_error" } }, 400)
  }

  const requestID = crypto.randomUUID()
  const estimate = estimateRequest(body, entitlement.plan, model)
  if (estimate.costNanos > 0 && request.headers.get("x-codetutor-cost-confirmed") !== "1") {
    const [spent, topupCredit] = await Promise.all([
      account.admin
        .from("managed_ai_usage")
        .select("included_cost_nanos")
        .eq("user_id", account.user.id)
        .eq("period_start", period.start)
        .maybeSingle(),
      creditBalance(account.admin, account.user.id),
    ])
    if (spent.error) throw spent.error
    const remainingCostNanos =
      Math.max(0, entitlement.plan.monthlySpendNanos - Number(spent.data?.included_cost_nanos ?? 0)) +
      topupCredit.remainingNanos
    if (costConfirmationRequired(estimate.costNanos, remainingCostNanos)) {
      return json(
        request,
        {
          error: {
            message: "Confirm this request because its estimated cost exceeds 10% of your remaining AI credit",
            type: "cost_confirmation_required",
            estimated_cost_usd: estimate.costNanos / 1_000_000_000,
            remaining_credit_usd: remainingCostNanos / 1_000_000_000,
          },
        },
        409,
      )
    }
  }
  const reserved = await reserveRequest(account.admin, {
    userID: account.user.id,
    requestID,
    plan: entitlement.plan,
    model: model.id,
    period,
    tokens: estimate.tokens,
    costNanos: estimate.costNanos,
  })
  if (!reserved.ok) return json(request, { error: { message: reserved.error, type: "quota_exceeded" } }, 429)

  if (account.kind === "service_key") {
    const keyReservation = await reserveServiceKey(account.admin, {
      keyID: account.serviceKey.id,
      requestID,
      model: model.id,
      costNanos: estimate.costNanos,
    })
    if (!keyReservation.ok) {
      await finalizeRequest(account.admin, {
        userID: account.user.id,
        requestID,
        model,
        usage: { input: 0, output: 0, cached: 0 },
        status: "released",
      })
      return json(request, { error: { message: keyReservation.error, type: "quota_exceeded" } }, 429)
    }
  }

  const release = async (
    actual: { input: number; output: number; cached: number; costNanos?: number },
    status: "completed" | "released",
  ) => {
    await finalizeRequest(account.admin, { userID: account.user.id, requestID, model, usage: actual, status })
    if (account.kind !== "service_key") return
    await finalizeServiceKey(account.admin, {
      keyID: account.serviceKey.id,
      requestID,
      costNanos: status === "completed" ? requestCostNanos(model, actual) : 0,
      status,
    })
  }
  const upstream = await gatewayRequest(request, body, entitlement.plan, account.user.id, model).catch(async () => {
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
  if (route === "billing-topup") return topup(request)
  if (route === "billing-change-plan") return changePlan(request)
  if (route === "billing-webhook") return webhook(request)
  if (route === "plans") return planList(request)
  if (route === "usage") return usage(request)
  if (route === "ai-chat") return chat(request)
  return json(request, { error: "not_found" }, 404)
}
