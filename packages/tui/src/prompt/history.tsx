import path from "path"
import { onMount } from "solid-js"
import { createStore, produce, unwrap } from "solid-js/store"
import type { AgentPart, FilePart, TextPart } from "@opencode-ai/sdk/v2"
import { createSimpleContext } from "../context/helper"
import { useTuiPaths } from "../context/runtime"
import { appendText, readText, writeText } from "../util/persistence"

export type PromptInfo = {
  input: string
  mode?: "normal" | "shell"
  parts: (
    | Omit<FilePart, "id" | "messageID" | "sessionID">
    | Omit<AgentPart, "id" | "messageID" | "sessionID">
    | (Omit<TextPart, "id" | "messageID" | "sessionID"> & {
        source?: {
          text: {
            start: number
            end: number
            value: string
          }
        }
      })
  )[]
}

export const MAX_HISTORY_ENTRIES = 50

export function parsePromptHistory(text: string) {
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        const entry: unknown = JSON.parse(line)
        return isPromptInfo(entry) ? entry : undefined
      } catch {
        return undefined
      }
    })
    .filter((line): line is PromptInfo => line !== undefined)
    .slice(-MAX_HISTORY_ENTRIES)
}

function isPromptInfo(input: unknown): input is PromptInfo {
  if (!isRecord(input)) return false
  if (typeof input.input !== "string" || !Array.isArray(input.parts)) return false
  if (input.mode !== undefined && input.mode !== "normal" && input.mode !== "shell") return false
  return input.parts.every(isPromptPart)
}

function isPromptPart(input: unknown): input is PromptInfo["parts"][number] {
  if (!isRecord(input) || typeof input.type !== "string") return false
  if (input.type === "text") {
    if (typeof input.text !== "string") return false
    if (input.synthetic !== undefined && typeof input.synthetic !== "boolean") return false
    if (input.ignored !== undefined && typeof input.ignored !== "boolean") return false
    if (input.time !== undefined && !isTime(input.time)) return false
    if (input.metadata !== undefined && !isRecord(input.metadata)) return false
    return input.source === undefined || isTextSource(input.source)
  }
  if (input.type === "file") {
    if (typeof input.mime !== "string" || typeof input.url !== "string") return false
    if (input.filename !== undefined && typeof input.filename !== "string") return false
    return input.source === undefined || isFileSource(input.source)
  }
  if (input.type === "agent") {
    if (typeof input.name !== "string") return false
    return input.source === undefined || isSourceText(input.source)
  }
  return false
}

function isFileSource(input: unknown) {
  if (!isRecord(input) || !isSourceText(input.text) || typeof input.type !== "string") return false
  if (input.type === "file") return typeof input.path === "string"
  if (input.type === "resource") return typeof input.clientName === "string" && typeof input.uri === "string"
  if (input.type !== "symbol") return false
  return (
    typeof input.path === "string" &&
    typeof input.name === "string" &&
    typeof input.kind === "number" &&
    isRange(input.range)
  )
}

function isTextSource(input: unknown) {
  return isRecord(input) && isSourceText(input.text)
}

function isSourceText(input: unknown) {
  return (
    isRecord(input) &&
    typeof input.value === "string" &&
    typeof input.start === "number" &&
    typeof input.end === "number"
  )
}

function isRange(input: unknown) {
  return isRecord(input) && isPosition(input.start) && isPosition(input.end)
}

function isPosition(input: unknown) {
  return isRecord(input) && typeof input.line === "number" && typeof input.character === "number"
}

function isTime(input: unknown) {
  return (
    isRecord(input) &&
    typeof input.start === "number" &&
    (input.end === undefined || typeof input.end === "number")
  )
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}

export function isDuplicateEntry(previous: PromptInfo | undefined, next: PromptInfo): boolean {
  if (!previous) return false
  return JSON.stringify(previous) === JSON.stringify(next)
}

export const { use: usePromptHistory, provider: PromptHistoryProvider } = createSimpleContext({
  name: "PromptHistory",
  init: () => {
    const paths = useTuiPaths()
    const historyPath = path.join(paths.state, "prompt-history.jsonl")
    onMount(async () => {
      const lines = parsePromptHistory(await readText(historyPath).catch(() => ""))
      setStore("history", lines)

      // Rewrite valid retained entries to self-heal corruption and enforce the limit.
      if (lines.length > 0)
        writeText(historyPath, lines.map((line) => JSON.stringify(line)).join("\n") + "\n").catch(() => {})
    })

    const [store, setStore] = createStore({
      index: 0,
      history: [] as PromptInfo[],
    })

    return {
      move(direction: 1 | -1, input: string) {
        if (!store.history.length) return undefined
        const current = store.history.at(store.index)
        if (!current) return undefined
        if (current.input !== input && input.length) return undefined
        setStore(
          produce((draft) => {
            const next = store.index + direction
            if (Math.abs(next) > store.history.length) return
            if (next > 0) return
            draft.index = next
          }),
        )
        if (store.index === 0) return { input: "", parts: [] }
        return store.history.at(store.index)
      },
      append(item: PromptInfo) {
        const entry = structuredClone(unwrap(item))
        if (isDuplicateEntry(store.history.at(-1), entry)) {
          setStore("index", 0)
          return
        }
        let trimmed = false
        setStore(
          produce((draft) => {
            draft.history.push(entry)
            if (draft.history.length > MAX_HISTORY_ENTRIES) {
              draft.history = draft.history.slice(-MAX_HISTORY_ENTRIES)
              trimmed = true
            }
            draft.index = 0
          }),
        )

        if (trimmed) {
          writeText(historyPath, store.history.map((line) => JSON.stringify(line)).join("\n") + "\n").catch(() => {})
          return
        }
        appendText(historyPath, JSON.stringify(entry) + "\n").catch(() => {})
      },
    }
  },
})
