import { Global } from "@opencode-ai/core/global"
import { Flock } from "@opencode-ai/core/util/flock"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import path from "node:path"

export const hostedOrigin = "https://codetutor-app-red.vercel.app"
const pendingLifetime = 10 * 60 * 1000
const pairingLifetime = 30 * 24 * 60 * 60 * 1000
const file = path.join(Global.Path.state, "local-pairings.json")

type Pending = {
  id: string
  code_hash: string
  origin: string
  user_id: string
  email: string
  expires_at: string
  approved_token?: string
}

export type Pairing = {
  id: string
  origin: string
  user_id: string
  email: string
  token_hash: string
  expires_at: string
  created_at: string
  revoked_at?: string
}

type Store = { pending: Pending[]; pairings: Pairing[] }

export async function request(input: { origin: string; userID: string; email: string }) {
  if (input.origin !== hostedOrigin) throw new Error("Pairing origin is not allowed")
  return Flock.withLock("local-pairings", async () => {
    const store = await read()
    const code = displayCode()
    const pending: Pending = {
      id: randomUUID(),
      code_hash: hash(code),
      origin: input.origin,
      user_id: input.userID,
      email: input.email,
      expires_at: new Date(Date.now() + pendingLifetime).toISOString(),
    }
    store.pending.push(pending)
    await write(clean(store))
    return { request_id: pending.id, code, expires_at: pending.expires_at }
  })
}

export async function approve(code: string, userID: string) {
  return Flock.withLock("local-pairings", async () => {
    const store = clean(await read())
    const pending = store.pending.find(
      (item) => item.code_hash === hash(code.trim().toUpperCase()) && item.user_id === userID,
    )
    if (!pending) return null
    const token = `ctpair_${randomBytes(32).toString("base64url")}`
    const pairing: Pairing = {
      id: randomUUID(),
      origin: pending.origin,
      user_id: pending.user_id,
      email: pending.email,
      token_hash: hash(token),
      expires_at: new Date(Date.now() + pairingLifetime).toISOString(),
      created_at: new Date().toISOString(),
    }
    pending.approved_token = token
    store.pairings.push(pairing)
    await write(store)
    return withoutHash(pairing)
  })
}

export async function poll(input: { requestID: string; origin: string }) {
  return Flock.withLock("local-pairings", async () => {
    const store = clean(await read())
    const index = store.pending.findIndex((item) => item.id === input.requestID && item.origin === input.origin)
    if (index === -1) return { status: "expired" as const }
    const pending = store.pending[index]
    if (!pending.approved_token) {
      await write(store)
      return { status: "pending" as const }
    }
    const token = pending.approved_token
    store.pending.splice(index, 1)
    await write(store)
    return { status: "approved" as const, token, user_id: pending.user_id, expires_at: pending.expires_at }
  })
}

export async function authorized(token: string, origin: string) {
  return Boolean(await resolve(token, origin))
}

export async function resolve(token: string, origin: string) {
  if (!token || origin !== hostedOrigin) return null
  const store = clean(await read())
  const pairing = store.pairings.find(
    (item) => !item.revoked_at && item.origin === origin && item.token_hash === hash(token),
  )
  return pairing ? withoutHash(pairing) : null
}

export async function list() {
  return clean(await read()).pairings.map(withoutHash)
}

export async function revoke(id?: string) {
  return Flock.withLock("local-pairings", async () => {
    const store = clean(await read())
    const now = new Date().toISOString()
    const revoked = store.pairings.filter((item) => !item.revoked_at && (!id || item.id === id))
    revoked.forEach((item) => (item.revoked_at = now))
    await write(store)
    return revoked.map((item) => item.id)
  })
}

function clean(store: Store) {
  const now = Date.now()
  return {
    pending: store.pending.filter((item) => Date.parse(item.expires_at) > now),
    pairings: store.pairings.filter((item) => item.revoked_at || Date.parse(item.expires_at) > now),
  }
}

async function read(): Promise<Store> {
  const source = Bun.file(file)
  if (!(await source.exists())) return { pending: [], pairings: [] }
  const value: unknown = await source.json().catch(() => null)
  if (!value || typeof value !== "object" || Array.isArray(value)) return { pending: [], pairings: [] }
  const result = value as Partial<Store>
  return {
    pending: Array.isArray(result.pending) ? result.pending : [],
    pairings: Array.isArray(result.pairings) ? result.pairings : [],
  }
}

async function write(store: Store) {
  await Bun.write(file, JSON.stringify(store, null, 2) + "\n", { createPath: true, mode: 0o600 })
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function displayCode() {
  const value = randomBytes(5).toString("hex").toUpperCase()
  return `${value.slice(0, 5)}-${value.slice(5)}`
}

function withoutHash(pairing: Pairing) {
  const { token_hash: _, ...result } = pairing
  return result
}

export * as LocalPairing from "./pairing"
