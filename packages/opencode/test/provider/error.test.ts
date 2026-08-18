import { expect, test } from "bun:test"
import { APICallError } from "ai"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ProviderError } from "@/provider/error"

const error = (input: { statusCode: number; message: string; responseBody: string }) =>
  new APICallError({
    ...input,
    url: "https://example.com/v1",
    requestBodyValues: {},
    responseHeaders: { "content-type": "application/json" },
    isRetryable: false,
  })

test("extracts a nested provider error message", () => {
  const result = ProviderError.parseAPICallError({
    providerID: ProviderV2.ID.make("google"),
    error: error({
      statusCode: 404,
      message: "Not Found",
      responseBody: JSON.stringify({ error: { message: "Use the replacement model" } }),
    }),
  })

  expect(result.message).toBe("Not Found: Use the replacement model")
})

test("provides an actionable provider login command for HTML auth failures", () => {
  const result = ProviderError.parseAPICallError({
    providerID: ProviderV2.ID.make("google"),
    error: error({ statusCode: 401, message: "Unauthorized", responseBody: "<!doctype html><html></html>" }),
  })

  expect(result.message).toContain("codetutor auth login --provider <provider-id>")
})

test("explains how to recover from a missing HTML model endpoint", () => {
  const result = ProviderError.parseAPICallError({
    providerID: ProviderV2.ID.make("google"),
    error: error({ statusCode: 404, message: "Not Found", responseBody: "<!doctype html><html></html>" }),
  })

  expect(result.message).toContain("codetutor models --refresh")
})
