import { LocalPairing } from "@/server/pairing"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { Effect, Option } from "effect"
import { AppRuntime } from "@/effect/app-runtime"
import { Account } from "@/account/account"

export const PairingCommand = cmd({
  command: "pairing",
  describe: "manage hosted-web access to this local CodeTutor server",
  builder: (yargs) =>
    yargs
      .command({
        command: "approve <code>",
        describe: "approve a pairing code shown by the hosted app",
        builder: (child) => child.positional("code", { type: "string", demandOption: true }),
        handler: async (args) => {
          const account = await AppRuntime.runPromise(
            Effect.gen(function* () {
              const service = yield* Account.Service
              const active = yield* service.active()
              if (Option.isNone(active)) return yield* Effect.fail(new Error("Sign in before approving a pairing"))
              return active.value
            }),
          )
          const pairing = await LocalPairing.approve(args.code, account.id)
          if (!pairing) throw new Error("Pairing code is invalid or expired")
          UI.println(`Approved ${pairing.email} for ${pairing.origin} until ${pairing.expires_at}`)
        },
      })
      .command({
        command: "list",
        aliases: ["ls"],
        describe: "list local hosted-web pairings",
        handler: async () => {
          const pairings = await LocalPairing.list()
          if (!pairings.length) return UI.println("No local pairings.")
          pairings.forEach((item) =>
            UI.println(`${item.id}  ${item.email}  ${item.origin}  ${item.revoked_at ? "revoked" : item.expires_at}`),
          )
        },
      })
      .command({
        command: "revoke [id]",
        describe: "revoke one pairing or every pairing",
        builder: (child) => child.positional("id", { type: "string" }),
        handler: async (args) => {
          const revoked = await LocalPairing.revoke(args.id)
          UI.println(`Revoked ${revoked.length} pairing${revoked.length === 1 ? "" : "s"}.`)
        },
      })
      .demandCommand(),
  async handler() {},
})
