import { Effect, Schema } from "effect"
import { AccessToken, AccountID, AccountRepoError, RefreshToken } from "./schema"

const service = "com.codetutor.cli.account"
const Credentials = Schema.Struct({ access_token: AccessToken, refresh_token: RefreshToken })
const StoredCredentials = Schema.fromJsonString(Credentials)
const decode = Schema.decodeUnknownSync(StoredCredentials)
const encode = Schema.encodeSync(StoredCredentials)

export type Credentials = Schema.Schema.Type<typeof Credentials>

const failure = (message: string) => (cause: unknown) => new AccountRepoError({ message, cause })

export const read = Effect.fn("AccountVault.read")((accountID: AccountID) =>
  Effect.tryPromise({
    try: async () => {
      const { Entry } = await import("@napi-rs/keyring")
      const value = new Entry(service, accountID).getPassword()
      return value ? decode(value) : null
    },
    catch: failure("Secure credential storage is unavailable. Sign in again after enabling the operating system vault."),
  }),
)

export const write = Effect.fn("AccountVault.write")((accountID: AccountID, credentials: Credentials) =>
  Effect.tryPromise({
    try: async () => {
      const { Entry } = await import("@napi-rs/keyring")
      new Entry(service, accountID).setPassword(encode(credentials))
    },
    catch: failure("CodeTutor could not save credentials in the operating system vault."),
  }),
)

export const remove = Effect.fn("AccountVault.remove")((accountID: AccountID) =>
  Effect.tryPromise({
    try: async () => {
      const { Entry } = await import("@napi-rs/keyring")
      const entry = new Entry(service, accountID)
      if (entry.getPassword()) entry.deletePassword()
    },
    catch: failure("CodeTutor could not remove credentials from the operating system vault."),
  }),
)

export const reference = (accountID: AccountID) => `vault:${accountID}`
