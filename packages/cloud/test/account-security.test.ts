import { describe, expect, test } from "bun:test"
import { profileUpdate } from "../src/profile"
import { maximumServiceKeyLifetimeDays, serviceKeyInput } from "../src/service-key"

describe("account security inputs", () => {
  test("accepts a bounded tutor profile and removes duplicate interests", () => {
    expect(
      profileUpdate({
        display_name: "Ada",
        learner_level: "advanced",
        goals: ["TypeScript", "TypeScript"],
        teaching_style: "concise",
        pace: "fast",
        accessibility: { reduced_motion: true },
      }),
    ).toEqual({
      display_name: "Ada",
      learner_level: "advanced",
      goals: ["TypeScript"],
      teaching_style: "concise",
      pace: "fast",
      accessibility: { reduced_motion: true },
    })
  })

  test("rejects malformed or oversized profile values", () => {
    expect(profileUpdate({ learner_level: "expert" })).toBeNull()
    expect(profileUpdate({ goals: Array.from({ length: 31 }, (_, index) => String(index)) })).toBeNull()
    expect(profileUpdate({ diagnostics_opt_in: "yes" })).toBeNull()
  })

  test("limits service keys to approved scopes and ninety days", () => {
    const valid = serviceKeyInput({
      name: "automation",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString(),
      scopes: ["managed_ai:invoke", "models:read"],
      model_allowlist: ["openai/gpt-5.4-mini"],
      request_limit: 100,
      credit_budget_usd: 2.5,
    })
    expect(valid?.creditLimitNanos).toBe(2_500_000_000)
    expect(serviceKeyInput({ name: "bad", expires_at: valid?.expiresAt, scopes: ["billing:write"] })).toBeNull()
    expect(
      serviceKeyInput({
        name: "too long",
        expires_at: new Date(Date.now() + (maximumServiceKeyLifetimeDays + 1) * 24 * 60 * 60 * 1_000).toISOString(),
      }),
    ).toBeNull()
  })
})
