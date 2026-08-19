import { cmd } from "./cmd"
import { Duration, Effect, Match, Option } from "effect"
import { UI } from "../ui"
import { Account } from "@/account/account"
import { AccountID, OrgID, PollExpired, type PollResult, type AccountError } from "@/account/schema"
import { effectCmd } from "../effect-cmd"
import * as Prompt from "../effect/prompt"
import open from "open"
import { AccountStrict } from "@/account/strict"

const openBrowser = (url: string) => Effect.promise(() => open(url).catch(() => undefined))

const println = (msg: string) => Effect.sync(() => UI.println(msg))

const dim = (value: string) => UI.Style.TEXT_DIM + value + UI.Style.TEXT_NORMAL

const activeSuffix = (isActive: boolean) => (isActive ? dim(" (active)") : "")

export const defaultAccountUrl = "https://codetutor-cloud.vercel.app"

export const accountUrl = () => process.env.CODETUTOR_ACCOUNT_URL?.trim() || defaultAccountUrl
export const accountAppUrl = () => process.env.CODETUTOR_APP_URL?.trim() || "https://codetutor-app-red.vercel.app"

export const formatAccountLabel = (account: { email: string; url: string }, isActive: boolean) =>
  `${account.email} ${dim(account.url)}${activeSuffix(isActive)}`

const formatOrgChoiceLabel = (account: { email: string }, org: { name: string }, isActive: boolean) =>
  `${org.name} (${account.email})${activeSuffix(isActive)}`

export const formatOrgLine = (
  account: { email: string; url: string },
  org: { id: string; name: string },
  isActive: boolean,
) => {
  const dot = isActive ? UI.Style.TEXT_SUCCESS + "●" + UI.Style.TEXT_NORMAL : " "
  const name = isActive ? UI.Style.TEXT_HIGHLIGHT_BOLD + org.name + UI.Style.TEXT_NORMAL : org.name
  return `  ${dot} ${name}  ${dim(account.email)}  ${dim(account.url)}  ${dim(org.id)}`
}

const isActiveOrgChoice = (
  active: Option.Option<{ id: AccountID; active_org_id: OrgID | null }>,
  choice: { accountID: AccountID; orgID: OrgID },
) => Option.isSome(active) && active.value.id === choice.accountID && active.value.active_org_id === choice.orgID

export const loginEffect = Effect.fn("login")(function* (url: string, strict = false) {
  const service = yield* Account.Service

  yield* Prompt.intro("Log in")
  const login = yield* service.login(url, strict)

  yield* Prompt.log.info("Go to: " + login.url)
  yield* Prompt.log.info("Enter code: " + login.user)
  yield* openBrowser(login.url)

  const s = Prompt.spinner()
  yield* s.start("Waiting for authorization...")

  const poll = (wait: Duration.Duration): Effect.Effect<PollResult, AccountError> =>
    Effect.gen(function* () {
      yield* Effect.sleep(wait)
      const result = yield* service.poll(login)
      if (result._tag === "PollPending") return yield* poll(wait)
      if (result._tag === "PollSlow") return yield* poll(Duration.sum(wait, Duration.seconds(5)))
      return result
    })

  const result = yield* poll(login.interval).pipe(
    Effect.timeout(login.expiry),
    Effect.catchTag("TimeoutError", () => Effect.succeed(new PollExpired())),
  )

  yield* Match.valueTags(result, {
    PollSuccess: (r) =>
      Effect.gen(function* () {
        yield* s.stop("Logged in as " + r.email)
        yield* Prompt.outro("Done")
      }),
    PollExpired: () => s.stop("Device code expired", 1),
    PollDenied: () => s.stop("Authorization denied", 1),
    PollError: (r) => s.stop("Error: " + String(r.cause), 1),
    PollPending: () => s.stop("Unexpected state", 1),
    PollSlow: () => s.stop("Unexpected state", 1),
  })
})

const logoutEffect = Effect.fn("logout")(function* (email?: string) {
  const service = yield* Account.Service
  const accounts = yield* service.list()
  if (accounts.length === 0) return yield* println("Not logged in")

  if (email) {
    const match = accounts.find((a) => a.email === email)
    if (!match) return yield* println("Account not found: " + email)
    yield* service.remove(match.id)
    yield* Prompt.outro("Logged out from " + email)
    return
  }

  const active = yield* service.active()
  const activeID = Option.map(active, (a) => a.id)

  yield* Prompt.intro("Log out")

  const opts = accounts.map((a) => {
    const isActive = Option.isSome(activeID) && activeID.value === a.id
    return {
      value: a,
      label: formatAccountLabel(a, isActive),
    }
  })

  const selected = yield* Prompt.select({ message: "Select account to log out", options: opts })
  if (Option.isNone(selected)) return

  yield* service.remove(selected.value.id)
  yield* Prompt.outro("Logged out from " + selected.value.email)
})

interface OrgChoice {
  orgID: OrgID
  accountID: AccountID
  label: string
}

const switchEffect = Effect.fn("switch")(function* () {
  const service = yield* Account.Service

  const groups = yield* service.orgsByAccount()
  if (groups.length === 0) return yield* println("Not logged in")

  const active = yield* service.active()

  const opts = groups.flatMap((group) =>
    group.orgs.map((org) => {
      const isActive = isActiveOrgChoice(active, { accountID: group.account.id, orgID: org.id })
      return {
        value: { orgID: org.id, accountID: group.account.id, label: org.name },
        label: formatOrgChoiceLabel(group.account, org, isActive),
      }
    }),
  )
  if (opts.length === 0) return yield* println("No orgs found")

  yield* Prompt.intro("Switch org")

  const selected = yield* Prompt.select<OrgChoice>({ message: "Select org", options: opts })
  if (Option.isNone(selected)) return

  const choice = selected.value
  yield* service.use(choice.accountID, Option.some(choice.orgID))
  yield* Prompt.outro("Switched to " + choice.label)
})

const orgsEffect = Effect.fn("orgs")(function* () {
  const service = yield* Account.Service

  const groups = yield* service.orgsByAccount()
  if (groups.length === 0) return yield* println("No accounts found")
  if (!groups.some((group) => group.orgs.length > 0)) return yield* println("No orgs found")

  const active = yield* service.active()

  for (const group of groups) {
    for (const org of group.orgs) {
      const isActive = isActiveOrgChoice(active, { accountID: group.account.id, orgID: org.id })
      yield* println(formatOrgLine(group.account, org, isActive))
    }
  }
})

const openEffect = Effect.fn("open")(function* () {
  const service = yield* Account.Service
  const active = yield* service.active()
  if (Option.isNone(active)) return yield* println("No active account")

  const url = active.value.url
  yield* openBrowser(url)
  yield* Prompt.outro("Opened " + url)
})

const statusEffect = Effect.fn("status")(function* () {
  const service = yield* Account.Service
  const accounts = yield* service.list()
  if (accounts.length === 0) return yield* println("Not logged in")

  const active = yield* service.active()
  for (const account of accounts) {
    const isActive = Option.isSome(active) && active.value.id === account.id
    yield* println(formatAccountLabel(account, isActive))
  }
})

const profileEffect = Effect.fn("profile")(function* () {
  const service = yield* Account.Service
  const account = yield* activeAccount()
  const result = yield* service.profile(account.id)
  yield* println(result.profile.display_name ?? result.email)
  yield* println(`Email: ${result.email}`)
  yield* println(`Learner level: ${result.profile.learner_level}`)
  yield* println(`Teaching style: ${result.profile.teaching_style} · Pace: ${result.profile.pace}`)
  if (result.profile.languages.length) yield* println(`Languages: ${result.profile.languages.join(", ")}`)
  if (result.profile.frameworks.length) yield* println(`Frameworks: ${result.profile.frameworks.join(", ")}`)
  if (result.profile.primary_model) yield* println(`Model: ${result.profile.primary_model}`)
})

const sessionsEffect = Effect.fn("sessions")(function* () {
  const service = yield* Account.Service
  const account = yield* activeAccount()
  const result = yield* service.sessions(account.id)
  for (const session of result.sessions) {
    const current = session.id === result.current_session_id ? " (current)" : ""
    const revoked = session.revoked_at ? ` · revoked ${session.revoked_at}` : ""
    yield* println(
      `${session.id}${current} · ${session.device_name ?? session.client_type} · ${session.platform ?? "unknown"} · ${session.last_seen_at}${revoked}`,
    )
  }
  if (!result.sessions.length) yield* println("No account sessions")
})

const revokeSessionEffect = Effect.fn("revokeSession")(function* (sessionID?: string, all?: boolean) {
  if (!sessionID && !all) return yield* Effect.fail(new Error("Provide a session ID or use --all."))
  const service = yield* Account.Service
  const account = yield* activeAccount()
  const revoked = yield* service.revokeSession(account.id, all ? undefined : sessionID)
  yield* Prompt.outro(`Revoked ${revoked.length} session${revoked.length === 1 ? "" : "s"}`)
})

const activeAccount = Effect.fn("activeAccount")(function* () {
  const service = yield* Account.Service
  const active = yield* service.active()
  if (Option.isNone(active)) return yield* Effect.fail(new Error("Not logged in. Run codetutor account login first."))
  return active.value
})

const planEffect = Effect.fn("plan")(function* () {
  const service = yield* Account.Service
  const account = yield* activeAccount()
  const entitlement = yield* service.entitlement(account.id)
  yield* println(`${entitlement.allowance.name} · $${entitlement.allowance.price_monthly}/month`)
  yield* println(`Included AI credit: $${entitlement.allowance.limits.spend_monthly_usd.toFixed(2)}`)
  yield* println(`Billing period: ${entitlement.period.start} to ${entitlement.period.end}`)
  yield* println(`Top-up balance: $${(entitlement.credit.remainingNanos / 1_000_000_000).toFixed(2)}`)
})

const plansEffect = Effect.fn("plans")(function* () {
  const service = yield* Account.Service
  const account = yield* activeAccount()
  for (const plan of yield* service.plans(account.id)) {
    yield* println(
      `${plan.name.padEnd(8)} $${String(plan.price_monthly).padEnd(2)}/month  ` +
        `$${plan.limits.spend_monthly_usd.toFixed(2)} AI credit  ${plan.limits.requests_monthly.toLocaleString()} requests`,
    )
  }
})

const usageEffect = Effect.fn("usage")(function* () {
  const service = yield* Account.Service
  const account = yield* activeAccount()
  const usage = yield* service.usage(account.id)
  yield* println(`${usage.plan.name} usage · ${usage.period_start} to ${usage.period_end}`)
  yield* println(`Requests: ${usage.usage.request_count.toLocaleString()} used · ${usage.remaining.requests.toLocaleString()} remaining`)
  yield* println(`Tokens: ${(usage.usage.input_tokens + usage.usage.output_tokens).toLocaleString()} used · ${usage.remaining.tokens.toLocaleString()} remaining`)
  yield* println(`Included AI credit: $${usage.usage.spend_usd.toFixed(4)} used · $${usage.remaining.spend_usd.toFixed(2)} remaining`)
  yield* println(`Top-up balance: $${(usage.credit.remainingNanos / 1_000_000_000).toFixed(2)}`)
})

const upgradeEffect = Effect.fn("upgrade")(function* (plan: "starter" | "pro") {
  yield* activeAccount()
  yield* openBrowser(`${accountAppUrl()}/account?action=upgrade&plan=${plan}`)
  yield* Prompt.outro(`Opened CodeTutor account to upgrade to ${plan}`)
})

const topupEffect = Effect.fn("topup")(function* (pack: "5" | "10" | "25") {
  yield* activeAccount()
  yield* openBrowser(`${accountAppUrl()}/account?action=topup&pack=${pack}`)
  yield* Prompt.outro(`Opened CodeTutor account to buy $${pack} AI credit`)
})

const billingEffect = Effect.fn("billing")(function* () {
  yield* activeAccount()
  yield* openBrowser(`${accountAppUrl()}/account?action=billing`)
  yield* Prompt.outro("Opened CodeTutor billing")
})

const accountActionEffect = Effect.fn("accountAction")(function* (action: string) {
  yield* activeAccount()
  yield* openBrowser(`${accountAppUrl()}/account?action=${action}`)
  yield* Prompt.outro("Opened CodeTutor account")
})

export const LoginCommand = effectCmd({
  command: "login [url]",
  describe: false,
  instance: false,
  builder: (yargs) =>
    yargs
      .positional("url", {
        describe: "server URL",
        type: "string",
      })
      .option("strict", {
        describe: "require approval again after 24 hours or four idle hours",
        type: "boolean",
      }),
  handler: Effect.fn("Cli.account.login")(function* (args) {
    UI.empty()
    yield* Effect.orDie(loginEffect(args.url ?? accountUrl(), args.strict))
  }),
})

export const LogoutCommand = effectCmd({
  command: "logout [email]",
  describe: false,
  instance: false,
  builder: (yargs) =>
    yargs.positional("email", {
      describe: "account email to log out from",
      type: "string",
    }),
  handler: Effect.fn("Cli.account.logout")(function* (args) {
    UI.empty()
    yield* Effect.orDie(logoutEffect(args.email))
  }),
})

export const SwitchCommand = effectCmd({
  command: "switch",
  describe: false,
  instance: false,
  handler: Effect.fn("Cli.account.switch")(function* () {
    UI.empty()
    yield* Effect.orDie(switchEffect())
  }),
})

export const OrgsCommand = effectCmd({
  command: "orgs",
  describe: false,
  instance: false,
  handler: Effect.fn("Cli.account.orgs")(function* () {
    UI.empty()
    yield* Effect.orDie(orgsEffect())
  }),
})

export const OpenCommand = effectCmd({
  command: "open",
  describe: false,
  instance: false,
  handler: Effect.fn("Cli.account.open")(function* () {
    UI.empty()
    yield* Effect.orDie(openEffect())
  }),
})

export const StatusCommand = effectCmd({
  command: "status",
  describe: false,
  instance: false,
  handler: Effect.fn("Cli.account.status")(function* () {
    UI.empty()
    yield* Effect.orDie(statusEffect())
  }),
})

export const PlanCommand = effectCmd({
  command: "plan",
  describe: false,
  instance: false,
  handler: Effect.fn("Cli.account.plan")(function* () {
    UI.empty()
    yield* Effect.orDie(planEffect())
  }),
})

export const PlansCommand = effectCmd({
  command: "plans",
  describe: false,
  instance: false,
  handler: Effect.fn("Cli.account.plans")(function* () {
    UI.empty()
    yield* Effect.orDie(plansEffect())
  }),
})

export const UsageCommand = effectCmd({
  command: "usage",
  describe: false,
  instance: false,
  handler: Effect.fn("Cli.account.usage")(function* () {
    UI.empty()
    yield* Effect.orDie(usageEffect())
  }),
})

export const UpgradeCommand = effectCmd({
  command: "upgrade <plan>",
  describe: false,
  instance: false,
  builder: (yargs) => yargs.positional("plan", { type: "string", choices: ["starter", "pro"] as const }),
  handler: Effect.fn("Cli.account.upgrade")(function* (args) {
    UI.empty()
    yield* Effect.orDie(upgradeEffect(args.plan))
  }),
})

export const TopupCommand = effectCmd({
  command: "topup <pack>",
  describe: false,
  instance: false,
  builder: (yargs) => yargs.positional("pack", { type: "string", choices: ["5", "10", "25"] as const }),
  handler: Effect.fn("Cli.account.topup")(function* (args) {
    UI.empty()
    yield* Effect.orDie(topupEffect(args.pack))
  }),
})

export const BillingCommand = effectCmd({
  command: "billing",
  describe: false,
  instance: false,
  handler: Effect.fn("Cli.account.billing")(function* () {
    UI.empty()
    yield* Effect.orDie(billingEffect())
  }),
})

export const ProfileCommand = effectCmd({
  command: "profile",
  describe: false,
  instance: false,
  handler: Effect.fn("Cli.account.profile")(function* () {
    UI.empty()
    yield* Effect.orDie(profileEffect())
  }),
})

export const SessionsCommand = effectCmd({
  command: "sessions",
  describe: false,
  instance: false,
  handler: Effect.fn("Cli.account.sessions")(function* () {
    UI.empty()
    yield* Effect.orDie(sessionsEffect())
  }),
})

export const RevokeSessionCommand = effectCmd({
  command: "revoke-session [session]",
  describe: false,
  instance: false,
  builder: (yargs) =>
    yargs
      .positional("session", { type: "string", describe: "session ID to revoke" })
      .option("all", { type: "boolean", describe: "revoke every active session" }),
  handler: Effect.fn("Cli.account.revokeSession")(function* (args) {
    UI.empty()
    yield* Effect.orDie(revokeSessionEffect(args.session, args.all))
  }),
})

export const StrictModeCommand = effectCmd({
  command: "strict-mode [state]",
  describe: false,
  instance: false,
  builder: (yargs) => yargs.positional("state", { type: "string", choices: ["on", "off"] as const }),
  handler: Effect.fn("Cli.account.strictMode")(function* (args) {
    const current = yield* AccountStrict.enabled()
    if (!args.state) {
      UI.println(`Strict login mode is ${current ? "on" : "off"}.`)
      return
    }
    yield* AccountStrict.set(args.state === "on")
    UI.println(`Strict login mode is now ${args.state}.`)
  }),
})

const browserAction = (command: string, action: string) =>
  effectCmd({
    command,
    describe: false,
    instance: false,
    handler: Effect.fn(`Cli.account.${action}`)(function* () {
      UI.empty()
      yield* Effect.orDie(accountActionEffect(action))
    }),
  })

export const ServiceKeysCommand = browserAction("service-keys", "service-keys")
export const CreateServiceKeyCommand = browserAction("service-key-create", "service-key-create")
export const RevokeServiceKeyCommand = browserAction("service-key-revoke <key>", "service-key-revoke")
export const ExportAccountCommand = browserAction("export", "export")
export const DeleteAccountCommand = browserAction("delete", "delete")

export const AccountCommand = cmd({
  command: "account",
  describe: "manage your CodeTutor account",
  builder: (yargs) =>
    yargs
      .command({
        ...LoginCommand,
        describe: "log in to CodeTutor",
      })
      .command({
        ...LogoutCommand,
        describe: "log out from CodeTutor",
      })
      .command({
        ...StatusCommand,
        describe: "show account status",
      })
      .command({
        ...OpenCommand,
        describe: "open the active CodeTutor account",
      })
      .command({ ...PlanCommand, describe: "show the active subscription plan" })
      .command({ ...PlansCommand, describe: "list CodeTutor subscription plans" })
      .command({ ...UsageCommand, describe: "show managed AI usage and credit" })
      .command({ ...UpgradeCommand, describe: "upgrade or change the subscription plan" })
      .command({ ...TopupCommand, describe: "buy prepaid managed AI credit" })
      .command({ ...BillingCommand, describe: "open the CodeTutor billing portal" })
      .command({ ...ProfileCommand, describe: "show your tutor profile" })
      .command({ ...SessionsCommand, describe: "list signed-in devices and sessions" })
      .command({ ...RevokeSessionCommand, describe: "revoke a device session" })
      .command({ ...StrictModeCommand, describe: "require browser approval whenever the interactive CLI starts" })
      .command({ ...ServiceKeysCommand, describe: "list scoped service keys" })
      .command({ ...CreateServiceKeyCommand, describe: "create a scoped service key" })
      .command({ ...RevokeServiceKeyCommand, describe: "revoke a scoped service key" })
      .command({ ...ExportAccountCommand, describe: "export your CodeTutor account data" })
      .command({ ...DeleteAccountCommand, describe: "schedule account deletion" })
      .demandCommand(),
  async handler() {},
})
