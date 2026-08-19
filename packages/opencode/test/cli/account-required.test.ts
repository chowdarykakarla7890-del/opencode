import { describe, expect, test } from "bun:test"
import { accountRequiredForArgs } from "../../src/cli/account-required"

const required = (args: string[]) => accountRequiredForArgs(args, false)

describe("CLI account rollout", () => {
  test("keeps the interactive shell and local learning available", () => {
    expect(required([])).toBeFalse()
    expect(required(["learn"])).toBeFalse()
    expect(required(["web"])).toBeFalse()
  })

  test("gates direct AI operations by default", () => {
    expect(required(["."])).toBeTrue()
    expect(required(["run", "teach me"])).toBeTrue()
    expect(required(["generate"])).toBeTrue()
  })

  test("keeps login, setup, recovery, and help available", () => {
    expect(required(["account", "login"])).toBeFalse()
    expect(required(["providers"])).toBeFalse()
    expect(required(["mcp", "add"])).toBeFalse()
    expect(required(["--log-level", "DEBUG", "account", "login"])).toBeFalse()
    expect(required(["debug"])).toBeFalse()
    expect(required(["upgrade"])).toBeFalse()
    expect(required(["--help"])).toBeFalse()
  })
})
