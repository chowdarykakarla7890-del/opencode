import { describe, expect, test } from "bun:test"
import { managedConfig } from "../api/config"
import { plans, unlimitedPlan } from "../src/plans"

describe("managed provider config", () => {
  test("forces free accounts through the CodeTutor Gateway", () => {
    const config = managedConfig(plans.free, "account-token", "https://cloud.example.com")
    expect("model" in config).toBe(false)
    expect(config.small_model).toBe("codetutor/poolside/laguna-s-2.1-free")
    expect(config.provider.codetutor.api).toBe("https://cloud.example.com/api/ai/v1")
    expect(Object.keys(config.provider.codetutor.models)).toEqual([
      "poolside/laguna-s-2.1-free",
      "google/gemini-3.1-flash-lite",
      "openai/gpt-5.4-mini",
      "free",
      "fast",
      "mentor",
    ])
    expect(config.provider.codetutor.name).toBe("CodeTutor")
  })

  test("lets every public plan select every managed model", () => {
    for (const plan of Object.values(plans)) {
      expect(Object.keys(managedConfig(plan, "token", "https://cloud.example.com").provider.codetutor.models)).toContain(
        "openai/gpt-5.4-mini",
      )
    }
  })

  test("gives private unlimited accounts every managed model", () => {
    const config = managedConfig(unlimitedPlan, "token", "https://cloud.example.com")
    expect("model" in config).toBe(false)
    expect(Object.keys(config.provider.codetutor.models)).toContain("openai/gpt-5.4-mini")
  })
})
