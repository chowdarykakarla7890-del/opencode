import { describe, expect, test } from "bun:test"
import stripAnsi from "strip-ansi"

import { accountUrl, defaultAccountUrl, formatAccountLabel, formatOrgLine } from "../../src/cli/cmd/account"

describe("CodeTutor account display", () => {
  test("uses the CodeTutor cloud deployment as the default login URL", () => {
    expect(defaultAccountUrl).toBe("https://codetutor-cloud.vercel.app")
    expect(accountUrl()).toBe(defaultAccountUrl)
  })

  test("includes the account url in account labels", () => {
    expect(stripAnsi(formatAccountLabel({ email: "one@example.com", url: "https://one.example.com" }, false))).toBe(
      "one@example.com https://one.example.com",
    )
  })

  test("includes the active marker in account labels", () => {
    expect(stripAnsi(formatAccountLabel({ email: "one@example.com", url: "https://one.example.com" }, true))).toBe(
      "one@example.com https://one.example.com (active)",
    )
  })

  test("includes the account url in org rows", () => {
    expect(
      stripAnsi(
        formatOrgLine({ email: "one@example.com", url: "https://one.example.com" }, { id: "org-1", name: "One" }, true),
      ),
    ).toBe("  ● One  one@example.com  https://one.example.com  org-1")
  })
})
