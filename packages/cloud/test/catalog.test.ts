import { afterEach, describe, expect, test } from "bun:test"
import { fallbackCatalog, modelCatalog, normalizeModel, parseCatalog, resetCatalogCache } from "../src/catalog"

afterEach(() => resetCatalogCache())

describe("Gateway model catalog", () => {
  test("classifies agent, chat-only, and unavailable models", () => {
    const base = {
      id: "example/model",
      name: "Example",
      owned_by: "example",
      type: "language",
      modalities: { input: ["text"], output: ["text"] },
      pricing: { input: "0.000001", output: "0.000002" },
    }
    expect(normalizeModel({ ...base, tags: ["tool-use"] })?.mode).toBe("agent")
    expect(normalizeModel({ ...base, tags: [] })?.mode).toBe("chat_only")
    expect(normalizeModel({ ...base, type: "image", modalities: { input: ["text"], output: ["image"] } })?.mode).toBe(
      "unavailable",
    )
    expect(normalizeModel({ ...base, pricing: {} })?.disabledReason).toBe("Gateway pricing is unavailable")
  })

  test("rejects malformed catalog entries", () => {
    expect(parseCatalog({ data: [{ id: "missing-slash", name: "Bad", type: "language" }, null] })).toEqual([])
  })

  test("caches successful catalogs and falls back on failure", async () => {
    const response = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "example/model",
                name: "Example",
                owned_by: "example",
                type: "language",
                tags: ["tool-use"],
                modalities: { input: ["text"], output: ["text"] },
                pricing: { input: "0", output: "0" },
              },
            ],
          }),
        ),
      )
    expect((await modelCatalog({ fetch: response, now: 1 })).map((model) => model.id)).toEqual(["example/model"])
    expect((await modelCatalog({ fetch: () => Promise.reject(new Error("offline")), now: 2 })).map((model) => model.id)).toEqual([
      "example/model",
    ])
    resetCatalogCache()
    expect((await modelCatalog({ fetch: () => Promise.reject(new Error("offline")), now: 3 })).length).toBe(
      fallbackCatalog().length,
    )
  })
})
