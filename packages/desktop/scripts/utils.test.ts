import { expect, test } from "bun:test"
import { getCurrentCli } from "./utils"

test("uses the published compatibility package for Linux x64", () => {
  expect(getCurrentCli("x86_64-unknown-linux-gnu").package).toBe("codetutor-linux-x64-musl")
})
