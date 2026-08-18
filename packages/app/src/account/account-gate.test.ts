import { describe, expect, test } from "bun:test"
import { callbackCode } from "./account-gate"

describe("CodeTutor account callback", () => {
  test("accepts only the desktop auth callback", () => {
    expect(callbackCode("codetutor://auth/callback?code=abc123")).toBe("abc123")
    expect(callbackCode("codetutor://other/callback?code=abc123")).toBeNull()
    expect(callbackCode("https://example.com/auth/callback?code=abc123")).toBeNull()
    expect(callbackCode("not a url")).toBeNull()
  })
})
