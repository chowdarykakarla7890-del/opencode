import { describe, expect, test } from "bun:test"
import { randomToken, randomUserCode, tokenHash } from "../src/token"

describe("account tokens", () => {
  test("generates URL-safe random tokens", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(randomToken()).not.toBe(randomToken())
  })

  test("generates readable device codes", () => {
    expect(randomUserCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
  })

  test("hashes deterministically without retaining the token", async () => {
    const value = "secret-token"
    expect(await tokenHash(value)).toBe(await tokenHash(value))
    expect(await tokenHash(value)).not.toContain(value)
  })
})
