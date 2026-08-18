import { expect, test } from "bun:test"
import { go, logo } from "../src/logo"

test("uses the compact CodeTutor Studio wordmark", () => {
  expect(logo.left).toHaveLength(3)
  expect(logo.right).toHaveLength(3)
  expect(logo.left.map((line) => Array.from(line).length)).toEqual([15, 15, 15])
  expect(logo.right.map((line) => Array.from(line).length)).toEqual([19, 19, 19])
  expect([...logo.left, ...logo.right].join("\n")).not.toMatch(/[█_^~]/)
  expect([...logo.left, ...logo.right].join("\n")).toContain("┏━╸")
})

test("uses a matching CT monogram", () => {
  expect(go.left).toHaveLength(3)
  expect(go.right).toHaveLength(3)
  expect(go.left.join("\n")).toContain("┗━╸")
  expect(go.right.join("\n")).toContain("╺┳╸")
})
