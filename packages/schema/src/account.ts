export * as Account from "./account"

import { Schema } from "effect"
import { optional } from "./schema"

export const LearnerLevel = Schema.Literals(["beginner", "intermediate", "advanced"])
export type LearnerLevel = typeof LearnerLevel.Type

export interface UserProfile extends Schema.Schema.Type<typeof UserProfile> {}
export const UserProfile = Schema.Struct({
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
}).annotate({ identifier: "Account.UserProfile" })

export interface AccountSession extends Schema.Schema.Type<typeof AccountSession> {}
export const AccountSession = Schema.Struct({
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
}).annotate({ identifier: "Account.Session" })

export interface ServiceKeySummary extends Schema.Schema.Type<typeof ServiceKeySummary> {}
export const ServiceKeySummary = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  token_prefix: Schema.String,
  scopes: Schema.Array(Schema.String),
  model_allowlist: Schema.Array(Schema.String),
  request_limit: Schema.NullOr(Schema.Number),
  request_count: Schema.Number,
  credit_limit_nanos: Schema.NullOr(Schema.Number),
  cost_nanos: Schema.Number,
  expires_at: Schema.String,
  last_used_at: Schema.NullOr(Schema.String),
  revoked_at: Schema.NullOr(Schema.String),
  created_at: Schema.String,
}).annotate({ identifier: "Account.ServiceKeySummary" })

export const PlanID = Schema.Literals(["free", "starter", "pro"])
export type PlanID = typeof PlanID.Type

export interface Plan extends Schema.Schema.Type<typeof Plan> {}
export const Plan = Schema.Struct({
  id: PlanID,
  name: Schema.String,
  price_monthly: Schema.Number,
  managed_ai: Schema.Boolean,
  model_access: Schema.String,
  limits: Schema.Struct({
    requests_monthly: Schema.Number,
    tokens_monthly: Schema.Number,
    spend_monthly_usd: Schema.Number,
    requests_per_minute: Schema.Number,
    concurrent_requests: Schema.Number,
    max_output_tokens: Schema.Number,
  }),
  models: Schema.Array(Schema.String),
}).annotate({ identifier: "Account.Plan" })

export interface CreditBalance extends Schema.Schema.Type<typeof CreditBalance> {}
export const CreditBalance = Schema.Struct({
  remainingNanos: Schema.Number,
  expiresAt: Schema.NullOr(Schema.String),
}).annotate({ identifier: "Account.CreditBalance" })

export interface PlanUsage extends Schema.Schema.Type<typeof PlanUsage> {}
export const PlanUsage = Schema.Struct({
  period_start: Schema.String,
  period_end: Schema.String,
  plan: Plan,
  usage: Schema.Struct({
    request_count: Schema.Number,
    input_tokens: Schema.Number,
    output_tokens: Schema.Number,
    spend_usd: Schema.Number,
  }),
  remaining: Schema.Struct({
    requests: Schema.Number,
    tokens: Schema.Number,
    spend_usd: Schema.Number,
  }),
  credit: CreditBalance,
}).annotate({ identifier: "Account.PlanUsage" })

export const ModelMode = Schema.Literals(["agent", "chat_only", "unavailable"])
export type ModelMode = typeof ModelMode.Type

export interface ModelCatalogEntry extends Schema.Schema.Type<typeof ModelCatalogEntry> {}
export const ModelCatalogEntry = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  creator: Schema.String,
  description: Schema.String,
  mode: ModelMode,
  model_type: Schema.String,
  input_modalities: Schema.Array(Schema.String),
  output_modalities: Schema.Array(Schema.String),
  tool_calling: Schema.Boolean,
  reasoning: Schema.Boolean,
  context_limit: Schema.Number,
  output_limit: Schema.Number,
  input_price: Schema.Number,
  output_price: Schema.Number,
  available: Schema.Boolean,
  disabled_reason: Schema.String.pipe(optional),
}).annotate({ identifier: "Account.ModelCatalogEntry" })

export interface LocalPairing extends Schema.Schema.Type<typeof LocalPairing> {}
export const LocalPairing = Schema.Struct({
  id: Schema.String,
  origin: Schema.String,
  user_id: Schema.String,
  expires_at: Schema.String,
  created_at: Schema.String,
  revoked_at: Schema.NullOr(Schema.String),
}).annotate({ identifier: "Account.LocalPairing" })
