import { creditBalance, subscriptionFor, usagePeriod } from "../src/billing.js"
import { requireIdentity } from "../src/database.js"
import { billingEnabled, managedAIEnabled, topupsEnabled } from "../src/env.js"
import { modelCatalog, selectableModelIDs } from "../src/catalog.js"
import { publicPlan } from "../src/plans.js"
import { json, methodNotAllowed, run } from "../src/response.js"

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "GET") return methodNotAllowed(request)
    const account = await requireIdentity(request)
    if (!account) return json(request, { error: "unauthorized" }, 401)
    const result = await subscriptionFor(account.admin, account.user.id)
    const models = selectableModelIDs(await modelCatalog())
    return json(request, {
      plan: result.plan.id,
      lessons: true,
      byok: false,
      progress_sync: false,
      session_sync: false,
      managed_ai: result.plan.managedAI && managedAIEnabled(),
      billing: billingEnabled(),
      topups: topupsEnabled(),
      period: usagePeriod(result),
      credit: await creditBalance(account.admin, account.user.id),
      subscription: result.subscription,
      allowance: publicPlan(result.plan, models),
    })
  })

export const GET = handler
export const OPTIONS = handler
