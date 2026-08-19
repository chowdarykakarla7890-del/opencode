export type ModelMode = "agent" | "chat_only" | "unavailable"

export type ModelCatalogEntry = {
  id: string
  name: string
  owner: string
  description: string
  type: string
  mode: ModelMode
  selectable: boolean
  disabledReason: string | null
  reasoning: boolean
  toolCall: boolean
  modalities: { input: string[]; output: string[] }
  contextWindow: number
  maxTokens: number
  pricing: { input: number; output: number; cachedInput: number }
  tags: string[]
  releaseDate: string
}

type GatewayModel = {
  id?: unknown
  name?: unknown
  owned_by?: unknown
  description?: unknown
  type?: unknown
  tags?: unknown
  modalities?: unknown
  context_window?: unknown
  max_tokens?: unknown
  pricing?: unknown
  released?: unknown
}

const fallback: ModelCatalogEntry[] = [
  {
    id: "poolside/laguna-s-2.1-free",
    name: "Laguna S 2.1 Free",
    owner: "poolside",
    description: "Free coding model",
    type: "language",
    mode: "agent",
    selectable: true,
    disabledReason: null,
    reasoning: true,
    toolCall: true,
    modalities: { input: ["text"], output: ["text"] },
    contextWindow: 256_000,
    maxTokens: 32_768,
    pricing: { input: 0, output: 0, cachedInput: 0 },
    tags: ["reasoning", "tool-use", "free"],
    releaseDate: "",
  },
  {
    id: "google/gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    owner: "google",
    description: "Fast multimodal language model",
    type: "language",
    mode: "agent",
    selectable: true,
    disabledReason: null,
    reasoning: true,
    toolCall: true,
    modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    contextWindow: 1_000_000,
    maxTokens: 65_000,
    pricing: { input: 0.00000025, output: 0.0000015, cachedInput: 0.00000003 },
    tags: ["reasoning", "tool-use", "vision"],
    releaseDate: "",
  },
  {
    id: "openai/gpt-5.4-mini",
    name: "GPT-5.4 Mini",
    owner: "openai",
    description: "Efficient reasoning and coding model",
    type: "language",
    mode: "agent",
    selectable: true,
    disabledReason: null,
    reasoning: true,
    toolCall: true,
    modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    contextWindow: 400_000,
    maxTokens: 128_000,
    pricing: { input: 0.00000075, output: 0.0000045, cachedInput: 0.000000075 },
    tags: ["reasoning", "tool-use", "vision"],
    releaseDate: "",
  },
]

const catalogURL = () => process.env.CODETUTOR_GATEWAY_MODELS_URL?.trim() || "https://ai-gateway.vercel.sh/v1/models"
const ttl = 6 * 60 * 60 * 1_000
let cached: { expires: number; models: ModelCatalogEntry[] } | undefined
type CatalogFetch = (input: string, init?: RequestInit) => Promise<Response>

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0

const price = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export const normalizeModel = (value: unknown): ModelCatalogEntry | null => {
  const model = object(value) as GatewayModel | null
  if (!model || typeof model.id !== "string" || !model.id.includes("/")) return null
  if (typeof model.name !== "string" || typeof model.type !== "string") return null
  const modalities = object(model.modalities)
  const input = strings(modalities?.input)
  const output = strings(modalities?.output)
  const tags = strings(model.tags)
  const pricing = object(model.pricing)
  const inputPrice = price(pricing?.input)
  const outputPrice = price(pricing?.output)
  const language = model.type === "language" && input.includes("text") && output.includes("text")
  const priced = inputPrice !== null && outputPrice !== null
  const toolCall = tags.includes("tool-use")
  const mode: ModelMode = !language || !priced ? "unavailable" : toolCall ? "agent" : "chat_only"
  const disabledReason = !language
    ? `CodeTutor tutor sessions do not support ${model.type} models yet`
    : !priced
      ? "Gateway pricing is unavailable"
      : null
  const released = number(model.released)
  return {
    id: model.id,
    name: model.name,
    owner: typeof model.owned_by === "string" ? model.owned_by : model.id.split("/")[0],
    description: typeof model.description === "string" ? model.description : "",
    type: model.type,
    mode,
    selectable: mode !== "unavailable",
    disabledReason,
    reasoning: tags.includes("reasoning"),
    toolCall,
    modalities: { input, output },
    contextWindow: number(model.context_window),
    maxTokens: number(model.max_tokens),
    pricing: {
      input: inputPrice ?? 0,
      output: outputPrice ?? 0,
      cachedInput: price(pricing?.cachedInput ?? pricing?.cached_input) ?? inputPrice ?? 0,
    },
    tags,
    releaseDate: released ? new Date(released * 1_000).toISOString().slice(0, 10) : "",
  }
}

export const parseCatalog = (value: unknown) => {
  const body = object(value)
  if (!Array.isArray(body?.data)) return []
  return body.data.map(normalizeModel).filter((model): model is ModelCatalogEntry => model !== null)
}

export const fallbackCatalog = () => fallback.map((model) => ({ ...model }))

export const modelCatalog = async (input?: { fetch?: CatalogFetch; now?: number; refresh?: boolean }) => {
  const now = input?.now ?? Date.now()
  if (!input?.refresh && cached && cached.expires > now) return cached.models
  const response = await (input?.fetch ?? fetch)(catalogURL(), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  }).catch(() => null)
  const models = response?.ok ? parseCatalog(await response.json().catch(() => null)) : []
  if (models.length === 0) return cached?.models ?? fallbackCatalog()
  cached = { expires: now + ttl, models }
  return models
}

export const modelByID = (models: readonly ModelCatalogEntry[], id: string) => models.find((model) => model.id === id)

export const selectableModelIDs = (models: readonly ModelCatalogEntry[]) =>
  models.filter((model) => model.selectable).map((model) => model.id)

export const resetCatalogCache = () => {
  cached = undefined
}
