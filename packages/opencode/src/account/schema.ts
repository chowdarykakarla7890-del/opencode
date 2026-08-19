import { Schema } from "effect"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"

export const AccountID = Schema.String.pipe(Schema.brand("AccountID"))
export type AccountID = Schema.Schema.Type<typeof AccountID>

export const OrgID = Schema.String.pipe(Schema.brand("OrgID"))
export type OrgID = Schema.Schema.Type<typeof OrgID>

export const AccessToken = Schema.String.pipe(Schema.brand("AccessToken"))
export type AccessToken = Schema.Schema.Type<typeof AccessToken>

export const RefreshToken = Schema.String.pipe(Schema.brand("RefreshToken"))
export type RefreshToken = Schema.Schema.Type<typeof RefreshToken>

export const DeviceCode = Schema.String.pipe(Schema.brand("DeviceCode"))
export type DeviceCode = Schema.Schema.Type<typeof DeviceCode>

export const UserCode = Schema.String.pipe(Schema.brand("UserCode"))
export type UserCode = Schema.Schema.Type<typeof UserCode>

export class Info extends Schema.Class<Info>("Account")({
  id: AccountID,
  email: Schema.String,
  url: Schema.String,
  active_org_id: Schema.NullOr(OrgID),
}) {}

export class Org extends Schema.Class<Org>("Org")({
  id: OrgID,
  name: Schema.String,
}) {}

export class AccountRepoError extends Schema.TaggedErrorClass<AccountRepoError>()("AccountRepoError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

export class AccountServiceError extends Schema.TaggedErrorClass<AccountServiceError>()("AccountServiceError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

export class AccountTransportError extends Schema.TaggedErrorClass<AccountTransportError>()("AccountTransportError", {
  method: Schema.String,
  url: Schema.String,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect()),
}) {
  static fromHttpClientError(error: HttpClientError.TransportError): AccountTransportError {
    return new AccountTransportError({
      method: error.request.method,
      url: error.request.url,
      description: error.description,
      cause: error.cause,
    })
  }

  override get message(): string {
    return [
      `Could not reach ${this.method} ${this.url}.`,
      `This failed before the server returned an HTTP response.`,
      this.description,
      `Check your network, proxy, or VPN configuration and try again.`,
    ]
      .filter(Boolean)
      .join("\n")
  }
}

export type AccountError = AccountRepoError | AccountServiceError | AccountTransportError

export const PlanID = Schema.Literals(["free", "starter", "pro"])
export type PlanID = Schema.Schema.Type<typeof PlanID>

export class PlanLimits extends Schema.Class<PlanLimits>("PlanLimits")({
  requests_monthly: Schema.Number,
  tokens_monthly: Schema.Number,
  spend_monthly_usd: Schema.Number,
  requests_per_minute: Schema.Number,
  concurrent_requests: Schema.Number,
  max_output_tokens: Schema.Number,
}) {}

export class Plan extends Schema.Class<Plan>("Plan")({
  id: PlanID,
  name: Schema.String,
  price_monthly: Schema.Number,
  managed_ai: Schema.Boolean,
  model_access: Schema.String,
  limits: PlanLimits,
  models: Schema.Array(Schema.String),
}) {}

export class PlanList extends Schema.Class<PlanList>("PlanList")({
  plans: Schema.Array(Plan),
}) {}

export class CreditBalance extends Schema.Class<CreditBalance>("CreditBalance")({
  remainingNanos: Schema.Number,
  expiresAt: Schema.NullOr(Schema.String),
}) {}

export class BillingPeriod extends Schema.Class<BillingPeriod>("BillingPeriod")({
  start: Schema.String,
  end: Schema.String,
}) {}

export class Entitlement extends Schema.Class<Entitlement>("Entitlement")({
  plan: Schema.String,
  managed_ai: Schema.Boolean,
  billing: Schema.Boolean,
  topups: Schema.Boolean,
  period: BillingPeriod,
  credit: CreditBalance,
  allowance: Plan,
}) {}

export class UsageValues extends Schema.Class<UsageValues>("UsageValues")({
  request_count: Schema.Number,
  input_tokens: Schema.Number,
  output_tokens: Schema.Number,
  spend_usd: Schema.Number,
}) {}

export class UsageRemaining extends Schema.Class<UsageRemaining>("UsageRemaining")({
  requests: Schema.Number,
  tokens: Schema.Number,
  spend_usd: Schema.Number,
}) {}

export class PlanUsage extends Schema.Class<PlanUsage>("PlanUsage")({
  period_start: Schema.String,
  period_end: Schema.String,
  plan: Plan,
  usage: UsageValues,
  remaining: UsageRemaining,
  credit: CreditBalance,
}) {}

export class BillingCheckout extends Schema.Class<BillingCheckout>("BillingCheckout")({
  url: Schema.String,
}) {}

export const LearnerLevel = Schema.Literals(["beginner", "intermediate", "advanced"])
export type LearnerLevel = Schema.Schema.Type<typeof LearnerLevel>

export class UserProfile extends Schema.Class<UserProfile>("UserProfile")({
  display_name: Schema.NullOr(Schema.String),
  avatar_url: Schema.NullOr(Schema.String),
  learner_level: LearnerLevel,
  goals: Schema.Array(Schema.String),
  languages: Schema.Array(Schema.String),
  frameworks: Schema.Array(Schema.String),
  ide: Schema.NullOr(Schema.String),
  teaching_style: Schema.String,
  pace: Schema.String,
  accessibility: Schema.Record(Schema.String, Schema.Json),
  primary_model: Schema.NullOr(Schema.String),
  helper_model: Schema.NullOr(Schema.String),
  helper_enabled: Schema.Boolean,
  diagnostics_opt_in: Schema.Boolean,
  notification_preferences: Schema.Record(Schema.String, Schema.Json),
  minimum_age_confirmed_at: Schema.NullOr(Schema.String),
  created_at: Schema.String,
  updated_at: Schema.String,
}) {}

export class ProfileResponse extends Schema.Class<ProfileResponse>("ProfileResponse")({
  profile: UserProfile,
  email: Schema.String,
}) {}

export class AccountSession extends Schema.Class<AccountSession>("AccountSession")({
  id: Schema.String,
  client_id: Schema.String,
  client_type: Schema.String,
  device_name: Schema.NullOr(Schema.String),
  platform: Schema.NullOr(Schema.String),
  last_seen_at: Schema.String,
  access_expires_at: Schema.String,
  refresh_expires_at: Schema.String,
  created_at: Schema.String,
  revoked_at: Schema.NullOr(Schema.String),
  revoked_reason: Schema.NullOr(Schema.String),
}) {}

export class AccountSessionList extends Schema.Class<AccountSessionList>("AccountSessionList")({
  current_session_id: Schema.NullOr(Schema.String),
  sessions: Schema.Array(AccountSession),
}) {}

export class SessionRevocation extends Schema.Class<SessionRevocation>("SessionRevocation")({
  revoked: Schema.Array(Schema.String),
}) {}

export class ServiceKeySummary extends Schema.Class<ServiceKeySummary>("ServiceKeySummary")({
  id: Schema.String,
  name: Schema.String,
  token_prefix: Schema.String,
  scopes: Schema.Array(Schema.String),
  model_allowlist: Schema.Array(Schema.String),
  expires_at: Schema.String,
  last_used_at: Schema.NullOr(Schema.String),
  revoked_at: Schema.NullOr(Schema.String),
  created_at: Schema.String,
}) {}

export class LocalPairing extends Schema.Class<LocalPairing>("LocalPairing")({
  id: Schema.String,
  origin: Schema.String,
  user_id: AccountID,
  expires_at: Schema.String,
  created_at: Schema.String,
  revoked_at: Schema.NullOr(Schema.String),
}) {}

export class Login extends Schema.Class<Login>("Login")({
  code: DeviceCode,
  user: UserCode,
  url: Schema.String,
  server: Schema.String,
  expiry: Schema.Duration,
  interval: Schema.Duration,
}) {}

export class PollSuccess extends Schema.TaggedClass<PollSuccess>()("PollSuccess", {
  email: Schema.String,
}) {}

export class PollPending extends Schema.TaggedClass<PollPending>()("PollPending", {}) {}

export class PollSlow extends Schema.TaggedClass<PollSlow>()("PollSlow", {}) {}

export class PollExpired extends Schema.TaggedClass<PollExpired>()("PollExpired", {}) {}

export class PollDenied extends Schema.TaggedClass<PollDenied>()("PollDenied", {}) {}

export class PollError extends Schema.TaggedClass<PollError>()("PollError", {
  cause: Schema.Defect(),
}) {}

export const PollResult = Schema.Union([PollSuccess, PollPending, PollSlow, PollExpired, PollDenied, PollError])
export type PollResult = Schema.Schema.Type<typeof PollResult>
