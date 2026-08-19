import { Global } from "@opencode-ai/core/global"
import { Effect } from "effect"
import path from "node:path"

const file = path.join(Global.Path.state, "account-strict.json")

export const enabled = Effect.fn("AccountStrict.enabled")(() =>
  Effect.promise(async () => {
    const source = Bun.file(file)
    if (!(await source.exists())) return false
    const value = await source.json().catch(() => undefined)
    return typeof value === "object" && value !== null && "enabled" in value && value.enabled === true
  }),
)

export const set = Effect.fn("AccountStrict.set")((value: boolean) =>
  Effect.promise(async () => {
    await Bun.write(file, JSON.stringify({ enabled: value, updated_at: new Date().toISOString() }) + "\n", {
      createPath: true,
      mode: 0o600,
    })
  }),
)

export * as AccountStrict from "./strict"
