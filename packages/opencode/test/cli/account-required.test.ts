import { afterEach, describe, expect, test } from "bun:test"
import { accountRequiredForArgs } from "../../src/cli/account-required"

const original = process.env.CODETUTOR_ACCOUNT_REQUIRED

afterEach(() => {
  if (original === undefined) delete process.env.CODETUTOR_ACCOUNT_REQUIRED
  if (original !== undefined) process.env.CODETUTOR_ACCOUNT_REQUIRED = original
})

describe("CLI account rollout", () => {
  test("does not gate anything until explicitly enabled", () => {
    delete process.env.CODETUTOR_ACCOUNT_REQUIRED
    expect(accountRequiredForArgs([])).toBeFalse()
    expect(accountRequiredForArgs(["learn"])).toBeFalse()
  })

  test("gates primary tutoring experiences", () => {
    process.env.CODETUTOR_ACCOUNT_REQUIRED = "1"
    expect(accountRequiredForArgs([])).toBeTrue()
    expect(accountRequiredForArgs(["."])).toBeTrue()
    expect(accountRequiredForArgs(["learn"])).toBeTrue()
    expect(accountRequiredForArgs(["run", "teach me"])).toBeTrue()
    expect(accountRequiredForArgs(["web"])).toBeTrue()
  })

  test("keeps login, setup, recovery, and help available", () => {
    process.env.CODETUTOR_ACCOUNT_REQUIRED = "1"
    expect(accountRequiredForArgs(["account", "login"])).toBeFalse()
    expect(accountRequiredForArgs(["providers"])).toBeFalse()
    expect(accountRequiredForArgs(["--log-level", "DEBUG", "account", "login"])).toBeFalse()
    expect(accountRequiredForArgs(["debug"])).toBeFalse()
    expect(accountRequiredForArgs(["upgrade"])).toBeFalse()
    expect(accountRequiredForArgs(["--help"])).toBeFalse()
  })
})
