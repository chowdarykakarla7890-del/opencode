import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { httpClient } from "@opencode-ai/core/effect/app-node-platform"
import { Cache, Clock, Duration, Effect, Layer, Option, Schema, SchemaGetter, Context } from "effect"
import { serviceUse } from "@opencode-ai/core/effect/service-use"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http"

import { withTransientReadRetry } from "@/util/effect-http-client"
import os from "node:os"
import { AccountRepo, type AccountRow } from "./repo"
import { normalizeServerUrl } from "./url"
import {
  type AccountError,
  AccessToken,
  AccountID,
  DeviceCode,
  Info,
  RefreshToken,
  AccountServiceError,
  AccountTransportError,
  Login,
  Org,
  OrgID,
  PollDenied,
  PollError,
  PollExpired,
  PollPending,
  type PollResult,
  PollSlow,
  PollSuccess,
  UserCode,
  Plan,
  PlanList,
  PlanUsage,
  Entitlement,
  BillingCheckout,
  type PlanID,
  ProfileResponse,
  AccountSessionList,
  SessionRevocation,
} from "./schema"

export {
  AccountID,
  type AccountError,
  AccountRepoError,
  AccountServiceError,
  AccountTransportError,
  AccessToken,
  RefreshToken,
  DeviceCode,
  UserCode,
  Info,
  Org,
  OrgID,
  Login,
  PollSuccess,
  PollPending,
  PollSlow,
  PollExpired,
  PollDenied,
  PollError,
  PollResult,
  Plan,
  PlanList,
  PlanUsage,
  Entitlement,
  BillingCheckout,
  PlanID,
  UserProfile,
  ProfileResponse,
  AccountSession,
  AccountSessionList,
  ServiceKeySummary,
  LocalPairing,
} from "./schema"

export type AccountOrgs = {
  account: Info
  orgs: readonly Org[]
}

export type ActiveOrg = {
  account: Info
  org: Org
}

class RemoteConfig extends Schema.Class<RemoteConfig>("RemoteConfig")({
  config: Schema.Record(Schema.String, Schema.Json),
}) {}

const DurationFromSeconds = Schema.Number.pipe(
  Schema.decodeTo(Schema.Duration, {
    decode: SchemaGetter.transform((n) => Duration.seconds(n)),
    encode: SchemaGetter.transform((d) => Duration.toSeconds(d)),
  }),
)

class TokenRefresh extends Schema.Class<TokenRefresh>("TokenRefresh")({
  access_token: AccessToken,
  refresh_token: RefreshToken,
  expires_in: DurationFromSeconds,
}) {}

class DeviceAuth extends Schema.Class<DeviceAuth>("DeviceAuth")({
  device_code: DeviceCode,
  user_code: UserCode,
  verification_uri_complete: Schema.String,
  expires_in: DurationFromSeconds,
  interval: DurationFromSeconds,
}) {}

class DeviceTokenSuccess extends Schema.Class<DeviceTokenSuccess>("DeviceTokenSuccess")({
  access_token: AccessToken,
  refresh_token: RefreshToken,
  token_type: Schema.Literal("Bearer"),
  expires_in: DurationFromSeconds,
}) {}

class DeviceTokenError extends Schema.Class<DeviceTokenError>("DeviceTokenError")({
  error: Schema.String,
  error_description: Schema.String,
}) {
  toPollResult(): PollResult {
    if (this.error === "authorization_pending") return new PollPending()
    if (this.error === "slow_down") return new PollSlow()
    if (this.error === "expired_token") return new PollExpired()
    if (this.error === "access_denied") return new PollDenied()
    return new PollError({ cause: this.error })
  }
}

const DeviceToken = Schema.Union([DeviceTokenSuccess, DeviceTokenError])

class User extends Schema.Class<User>("User")({
  id: AccountID,
  email: Schema.String,
}) {}

class DeviceAuthorizationRequest extends Schema.Class<DeviceAuthorizationRequest>("DeviceAuthorizationRequest")({
  client_id: Schema.String,
  client_type: Schema.Literal("cli"),
  device_name: Schema.String,
  platform: Schema.String,
  strict_login: Schema.Boolean,
}) {}

class DeviceTokenRequest extends Schema.Class<DeviceTokenRequest>("DeviceTokenRequest")({
  grant_type: Schema.String,
  device_code: DeviceCode,
  client_id: Schema.String,
}) {}

class TokenRefreshRequest extends Schema.Class<TokenRefreshRequest>("TokenRefreshRequest")({
  grant_type: Schema.String,
  refresh_token: RefreshToken,
  client_id: Schema.String,
}) {}

const clientId = "codetutor-cli"
const eagerRefreshThreshold = Duration.minutes(5)
const eagerRefreshThresholdMs = Duration.toMillis(eagerRefreshThreshold)

const isTokenFresh = (tokenExpiry: number | null, now: number) =>
  tokenExpiry != null && tokenExpiry > now + eagerRefreshThresholdMs

const mapAccountServiceError =
  (message = "Account service operation failed") =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, AccountError, R> =>
    effect.pipe(Effect.mapError((cause) => accountErrorFromCause(cause, message)))

const accountErrorFromCause = (cause: unknown, message: string): AccountError => {
  if (cause instanceof AccountServiceError || cause instanceof AccountTransportError) {
    return cause
  }

  if (HttpClientError.isHttpClientError(cause)) {
    switch (cause.reason._tag) {
      case "TransportError": {
        return AccountTransportError.fromHttpClientError(cause.reason)
      }
      default: {
        return new AccountServiceError({ message, cause })
      }
    }
  }

  return new AccountServiceError({ message, cause })
}

export interface Interface {
  readonly active: () => Effect.Effect<Option.Option<Info>, AccountError>
  readonly activeOrg: () => Effect.Effect<Option.Option<ActiveOrg>, AccountError>
  readonly list: () => Effect.Effect<Info[], AccountError>
  readonly orgsByAccount: () => Effect.Effect<readonly AccountOrgs[], AccountError>
  readonly remove: (accountID: AccountID) => Effect.Effect<void, AccountError>
  readonly use: (accountID: AccountID, orgID: Option.Option<OrgID>) => Effect.Effect<void, AccountError>
  readonly orgs: (accountID: AccountID) => Effect.Effect<readonly Org[], AccountError>
  readonly config: (
    accountID: AccountID,
    orgID?: OrgID,
  ) => Effect.Effect<Option.Option<Record<string, unknown>>, AccountError>
  readonly token: (accountID: AccountID) => Effect.Effect<Option.Option<AccessToken>, AccountError>
  readonly login: (url: string, strict?: boolean) => Effect.Effect<Login, AccountError>
  readonly poll: (input: Login) => Effect.Effect<PollResult, AccountError>
  readonly plans: (accountID: AccountID) => Effect.Effect<readonly Plan[], AccountError>
  readonly entitlement: (accountID: AccountID) => Effect.Effect<Entitlement, AccountError>
  readonly usage: (accountID: AccountID) => Effect.Effect<PlanUsage, AccountError>
  readonly changePlan: (accountID: AccountID, plan: PlanID) => Effect.Effect<BillingCheckout, AccountError>
  readonly topup: (accountID: AccountID, pack: "5" | "10" | "25") => Effect.Effect<BillingCheckout, AccountError>
  readonly billing: (accountID: AccountID) => Effect.Effect<BillingCheckout, AccountError>
  readonly profile: (accountID: AccountID) => Effect.Effect<ProfileResponse, AccountError>
  readonly sessions: (accountID: AccountID) => Effect.Effect<AccountSessionList, AccountError>
  readonly revokeSession: (accountID: AccountID, sessionID?: string) => Effect.Effect<readonly string[], AccountError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Account") {}

export const use = serviceUse(Service)

const layer: Layer.Layer<Service, never, AccountRepo.Service | HttpClient.HttpClient> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const repo = yield* AccountRepo.Service
    const http = yield* HttpClient.HttpClient
    const httpRead = withTransientReadRetry(http)
    const httpOk = HttpClient.filterStatusOk(http)
    const httpReadOk = HttpClient.filterStatusOk(httpRead)

    const executeRead = (request: HttpClientRequest.HttpClientRequest) =>
      httpRead.execute(request).pipe(mapAccountServiceError("HTTP request failed"))

    const executeReadOk = (request: HttpClientRequest.HttpClientRequest) =>
      httpReadOk.execute(request).pipe(mapAccountServiceError("HTTP request failed"))

    const executeEffectOk = <E>(request: Effect.Effect<HttpClientRequest.HttpClientRequest, E>) =>
      request.pipe(
        Effect.flatMap((req) => httpOk.execute(req)),
        mapAccountServiceError("HTTP request failed"),
      )

    const executeEffect = <E>(request: Effect.Effect<HttpClientRequest.HttpClientRequest, E>) =>
      request.pipe(
        Effect.flatMap((req) => http.execute(req)),
        mapAccountServiceError("HTTP request failed"),
      )

    const refreshToken = Effect.fnUntraced(function* (row: AccountRow) {
      const now = yield* Clock.currentTimeMillis

      const response = yield* executeEffectOk(
        HttpClientRequest.post(`${row.url}/auth/device/token`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.schemaBodyJson(TokenRefreshRequest)(
            new TokenRefreshRequest({
              grant_type: "refresh_token",
              refresh_token: row.refresh_token,
              client_id: clientId,
            }),
          ),
        ),
      )

      const parsed = yield* HttpClientResponse.schemaBodyJson(TokenRefresh)(response).pipe(
        mapAccountServiceError("Failed to decode response"),
      )

      const expiry = Option.some(now + Duration.toMillis(parsed.expires_in))

      yield* repo.persistToken({
        accountID: row.id,
        accessToken: parsed.access_token,
        refreshToken: parsed.refresh_token,
        expiry,
      })

      return parsed.access_token
    })

    const refreshTokenCache = yield* Cache.make<AccountID, AccessToken, AccountError>({
      capacity: Number.POSITIVE_INFINITY,
      timeToLive: Duration.zero,
      lookup: Effect.fnUntraced(function* (accountID) {
        const maybeAccount = yield* repo.getRow(accountID)
        if (Option.isNone(maybeAccount)) {
          return yield* Effect.fail(new AccountServiceError({ message: "Account not found during token refresh" }))
        }

        const account = maybeAccount.value
        const now = yield* Clock.currentTimeMillis
        if (isTokenFresh(account.token_expiry, now)) {
          return account.access_token
        }

        return yield* refreshToken(account)
      }),
    })

    const resolveToken = Effect.fnUntraced(function* (row: AccountRow) {
      const now = yield* Clock.currentTimeMillis
      if (isTokenFresh(row.token_expiry, now)) {
        return row.access_token
      }

      return yield* Cache.get(refreshTokenCache, row.id)
    })

    const resolveAccess = Effect.fnUntraced(function* (accountID: AccountID) {
      const maybeAccount = yield* repo.getRow(accountID)
      if (Option.isNone(maybeAccount)) return Option.none()

      const account = maybeAccount.value
      const accessToken = yield* resolveToken(account)
      return Option.some({ account, accessToken })
    })

    const fetchOrgs = Effect.fnUntraced(function* (url: string, accessToken: AccessToken) {
      const response = yield* executeReadOk(
        HttpClientRequest.get(`${url}/api/orgs`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.bearerToken(accessToken),
        ),
      )

      return yield* HttpClientResponse.schemaBodyJson(Schema.Array(Org))(response).pipe(
        mapAccountServiceError("Failed to decode response"),
      )
    })

    const fetchUser = Effect.fnUntraced(function* (url: string, accessToken: AccessToken) {
      const response = yield* executeReadOk(
        HttpClientRequest.get(`${url}/api/user`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.bearerToken(accessToken),
        ),
      )

      return yield* HttpClientResponse.schemaBodyJson(User)(response).pipe(
        mapAccountServiceError("Failed to decode response"),
      )
    })

    const token = Effect.fn("Account.token")((accountID: AccountID) =>
      resolveAccess(accountID).pipe(Effect.map(Option.map((r) => r.accessToken))),
    )

    const activeOrg = Effect.fn("Account.activeOrg")(function* () {
      const activeAccount = yield* repo.active()
      if (Option.isNone(activeAccount)) return Option.none<ActiveOrg>()

      const account = activeAccount.value
      if (!account.active_org_id) return Option.none<ActiveOrg>()

      const accountOrgs = yield* orgs(account.id)
      const org = accountOrgs.find((item) => item.id === account.active_org_id)
      if (!org) return Option.none<ActiveOrg>()

      return Option.some({ account, org })
    })

    const orgsByAccount = Effect.fn("Account.orgsByAccount")(function* () {
      const accounts = yield* repo.list()
      return yield* Effect.forEach(
        accounts,
        (account) =>
          orgs(account.id).pipe(
            Effect.catch(() => Effect.succeed([] as readonly Org[])),
            Effect.map((orgs) => ({ account, orgs })),
          ),
        { concurrency: 3 },
      )
    })

    const orgs = Effect.fn("Account.orgs")(function* (accountID: AccountID) {
      const resolved = yield* resolveAccess(accountID)
      if (Option.isNone(resolved)) return []

      const { account, accessToken } = resolved.value

      return yield* fetchOrgs(account.url, accessToken)
    })

    const remove = Effect.fn("Account.remove")(function* (accountID: AccountID) {
      const active = yield* repo.active()
      yield* repo.remove(accountID)
      if (Option.isNone(active) || active.value.id !== accountID) return

      const next = (yield* orgsByAccount()).flatMap((group) =>
        group.orgs.map((org) => ({ accountID: group.account.id, orgID: org.id })),
      )[0]
      if (!next) return
      yield* repo.use(next.accountID, Option.some(next.orgID))
    })

    const config = Effect.fn("Account.config")(function* (accountID: AccountID, orgID?: OrgID) {
      const resolved = yield* resolveAccess(accountID)
      if (Option.isNone(resolved)) return Option.none()

      const { account, accessToken } = resolved.value

      const response = yield* executeRead(
        HttpClientRequest.get(`${account.url}/api/config`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.bearerToken(accessToken),
          HttpClientRequest.setHeaders(orgID ? { "x-org-id": orgID } : {}),
        ),
      )

      if (response.status === 404) return Option.none()

      const ok = yield* HttpClientResponse.filterStatusOk(response).pipe(mapAccountServiceError())

      const parsed = yield* HttpClientResponse.schemaBodyJson(RemoteConfig)(ok).pipe(
        mapAccountServiceError("Failed to decode response"),
      )
      return Option.some(parsed.config)
    })

    const accountResponse = Effect.fnUntraced(function* (
      accountID: AccountID,
      path: string,
      init?: { method?: "POST" | "DELETE"; body?: Record<string, string | boolean> },
    ) {
      const resolved = yield* resolveAccess(accountID)
      if (Option.isNone(resolved)) {
        return yield* Effect.fail(new AccountServiceError({ message: "Account not found" }))
      }
      const request = init
        ? (init.method === "DELETE"
            ? HttpClientRequest.delete(`${resolved.value.account.url}${path}`)
            : HttpClientRequest.post(`${resolved.value.account.url}${path}`)
          ).pipe(
            HttpClientRequest.acceptJson,
            HttpClientRequest.bearerToken(resolved.value.accessToken),
            HttpClientRequest.bodyJson(init.body ?? {}),
          )
        : Effect.succeed(
            HttpClientRequest.get(`${resolved.value.account.url}${path}`).pipe(
              HttpClientRequest.acceptJson,
              HttpClientRequest.bearerToken(resolved.value.accessToken),
            ),
          )
      return yield* executeEffectOk(request)
    })

    const plans = Effect.fn("Account.plans")(function* (accountID: AccountID) {
      const response = yield* accountResponse(accountID, "/api/plans")
      const parsed = yield* HttpClientResponse.schemaBodyJson(PlanList)(response).pipe(
        mapAccountServiceError("Failed to decode plans"),
      )
      return parsed.plans
    })

    const entitlement = Effect.fn("Account.entitlement")(function* (accountID: AccountID) {
      const response = yield* accountResponse(accountID, "/api/entitlements")
      return yield* HttpClientResponse.schemaBodyJson(Entitlement)(response).pipe(
        mapAccountServiceError("Failed to decode entitlement"),
      )
    })

    const usage = Effect.fn("Account.usage")(function* (accountID: AccountID) {
      const response = yield* accountResponse(accountID, "/api/usage")
      return yield* HttpClientResponse.schemaBodyJson(PlanUsage)(response).pipe(
        mapAccountServiceError("Failed to decode usage"),
      )
    })

    const changePlan = Effect.fn("Account.changePlan")(function* (accountID: AccountID, plan: PlanID) {
      const response = yield* accountResponse(accountID, "/api/billing/change-plan", { body: { plan } })
      return yield* HttpClientResponse.schemaBodyJson(BillingCheckout)(response).pipe(
        mapAccountServiceError("Failed to start plan change"),
      )
    })

    const topup = Effect.fn("Account.topup")(function* (accountID: AccountID, pack: "5" | "10" | "25") {
      const response = yield* accountResponse(accountID, "/api/billing/topup", { body: { pack } })
      return yield* HttpClientResponse.schemaBodyJson(BillingCheckout)(response).pipe(
        mapAccountServiceError("Failed to start top-up checkout"),
      )
    })

    const billing = Effect.fn("Account.billing")(function* (accountID: AccountID) {
      const response = yield* accountResponse(accountID, "/api/billing/portal", { body: {} })
      return yield* HttpClientResponse.schemaBodyJson(BillingCheckout)(response).pipe(
        mapAccountServiceError("Failed to open billing portal"),
      )
    })

    const profile = Effect.fn("Account.profile")(function* (accountID: AccountID) {
      const response = yield* accountResponse(accountID, "/api/profile")
      return yield* HttpClientResponse.schemaBodyJson(ProfileResponse)(response).pipe(
        mapAccountServiceError("Failed to decode profile"),
      )
    })

    const sessions = Effect.fn("Account.sessions")(function* (accountID: AccountID) {
      const response = yield* accountResponse(accountID, "/api/account/sessions")
      return yield* HttpClientResponse.schemaBodyJson(AccountSessionList)(response).pipe(
        mapAccountServiceError("Failed to decode account sessions"),
      )
    })

    const revokeSession = Effect.fn("Account.revokeSession")(function* (accountID: AccountID, sessionID?: string) {
      const response = yield* accountResponse(accountID, "/api/account/sessions", {
        method: "DELETE",
        body: sessionID ? { session_id: sessionID } : { all: true },
      })
      const parsed = yield* HttpClientResponse.schemaBodyJson(SessionRevocation)(response).pipe(
        mapAccountServiceError("Failed to revoke account session"),
      )
      return parsed.revoked
    })

    const login = Effect.fn("Account.login")(function* (server: string, strict = false) {
      const normalizedServer = normalizeServerUrl(server)
      const response = yield* executeEffectOk(
        HttpClientRequest.post(`${normalizedServer}/auth/device/code`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.schemaBodyJson(DeviceAuthorizationRequest)(
            new DeviceAuthorizationRequest({
              client_id: clientId,
              client_type: "cli",
              device_name: os.hostname(),
              platform: process.platform,
              strict_login: strict,
            }),
          ),
        ),
      )

      const parsed = yield* HttpClientResponse.schemaBodyJson(DeviceAuth)(response).pipe(
        mapAccountServiceError("Failed to decode response"),
      )
      return new Login({
        code: parsed.device_code,
        user: parsed.user_code,
        url: `${normalizedServer}${parsed.verification_uri_complete}`,
        server: normalizedServer,
        expiry: parsed.expires_in,
        interval: parsed.interval,
      })
    })

    const poll = Effect.fn("Account.poll")(function* (input: Login) {
      const response = yield* executeEffect(
        HttpClientRequest.post(`${input.server}/auth/device/token`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.schemaBodyJson(DeviceTokenRequest)(
            new DeviceTokenRequest({
              grant_type: "urn:ietf:params:oauth:grant-type:device_code",
              device_code: input.code,
              client_id: clientId,
            }),
          ),
        ),
      )

      const parsed = yield* HttpClientResponse.schemaBodyJson(DeviceToken)(response).pipe(
        mapAccountServiceError("Failed to decode response"),
      )

      if (parsed instanceof DeviceTokenError) return parsed.toPollResult()
      const accessToken = parsed.access_token

      const account = yield* fetchUser(input.server, accessToken)

      const now = yield* Clock.currentTimeMillis
      const expiry = now + Duration.toMillis(parsed.expires_in)
      const refreshToken = parsed.refresh_token

      yield* repo.persistAccount({
        id: account.id,
        email: account.email,
        url: input.server,
        accessToken,
        refreshToken,
        expiry,
        orgID: Option.none(),
      })

      return new PollSuccess({ email: account.email })
    })

    return Service.of({
      active: repo.active,
      activeOrg,
      list: repo.list,
      orgsByAccount,
      remove,
      use: repo.use,
      orgs,
      config,
      token,
      login,
      poll,
      plans,
      entitlement,
      usage,
      changePlan,
      topup,
      billing,
      profile,
      sessions,
      revokeSession,
    })
  }),
)

export const node = LayerNode.make({ service: Service, layer: layer, deps: [AccountRepo.node, httpClient] })

export * as Account from "./account"
