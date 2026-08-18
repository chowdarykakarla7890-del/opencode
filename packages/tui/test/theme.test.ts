import { expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import type { TerminalColors } from "@opentui/core"
import { DEFAULT_THEMES, addTheme, allThemes, hasTheme, resolveTheme, terminalMode } from "../src/theme"
import { discoverThemes } from "../src/context/theme"
import { tmpdir } from "./fixture/fixture"
import { isStudioTheme } from "../src/ui/studio"

function ints(color: ReturnType<typeof resolveTheme>["background"]) {
  return color.toInts().slice(0, 3)
}

test("codetutor is the canonical built-in Studio theme", () => {
  expect(DEFAULT_THEMES.codetutor).toBeDefined()
  expect(DEFAULT_THEMES.opencode).toBeUndefined()
  expect(isStudioTheme("codetutor")).toBe(true)
  expect(isStudioTheme("dracula")).toBe(false)
})

test("codetutor dark mode resolves the Studio graphite and amber tokens", () => {
  const theme = resolveTheme(DEFAULT_THEMES.codetutor, "dark")
  expect(ints(theme.background)).toEqual([9, 10, 11])
  expect(ints(theme.backgroundPanel)).toEqual([17, 19, 21])
  expect(ints(theme.backgroundElement)).toEqual([23, 26, 28])
  expect(ints(theme.border)).toEqual([48, 52, 56])
  expect(ints(theme.primary)).toEqual([242, 163, 95])
  expect(ints(theme.text)).toEqual([231, 231, 231])
  expect(ints(theme.textMuted)).toEqual([139, 144, 149])
})

test("codetutor light mode keeps its existing palette", () => {
  const theme = resolveTheme(DEFAULT_THEMES.codetutor, "light")
  expect(ints(theme.background)).toEqual([255, 255, 255])
  expect(ints(theme.backgroundPanel)).toEqual([250, 250, 250])
  expect(ints(theme.backgroundElement)).toEqual([245, 245, 245])
  expect(ints(theme.border)).toEqual([184, 184, 184])
  expect(ints(theme.primary)).toEqual([59, 125, 216])
  expect(ints(theme.text)).toEqual([26, 26, 26])
  expect(ints(theme.textMuted)).toEqual([138, 138, 138])
})

test("addTheme writes into module theme store", () => {
  const name = `plugin-theme-${Date.now()}`
  expect(addTheme(name, DEFAULT_THEMES.codetutor)).toBe(true)
  expect(allThemes()[name]).toBeDefined()
})

test("addTheme keeps first theme for duplicate names", () => {
  const name = `plugin-theme-keep-${Date.now()}`
  const one = structuredClone(DEFAULT_THEMES.codetutor)
  const two = structuredClone(DEFAULT_THEMES.codetutor)
  one.theme.primary = "#101010"
  two.theme.primary = "#fefefe"

  expect(addTheme(name, one)).toBe(true)
  expect(addTheme(name, two)).toBe(false)
  expect(allThemes()[name]!.theme.primary).toBe("#101010")
})

test("addTheme ignores entries without a theme object", () => {
  const name = `plugin-theme-invalid-${Date.now()}`
  expect(addTheme(name, { defs: { a: "#ffffff" } })).toBe(false)
  expect(allThemes()[name]).toBeUndefined()
})

test("hasTheme checks theme presence", () => {
  const name = `plugin-theme-has-${Date.now()}`
  expect(hasTheme(name)).toBe(false)
  expect(addTheme(name, DEFAULT_THEMES.codetutor)).toBe(true)
  expect(hasTheme(name)).toBe(true)
})

test("resolveTheme rejects circular color refs", () => {
  const item = structuredClone(DEFAULT_THEMES.codetutor)
  item.defs = { ...item.defs, one: "two", two: "one" }
  item.theme.primary = "one"
  expect(() => resolveTheme(item, "dark")).toThrow("Circular color reference")
})

function terminalColors(defaultBackground: string | null, palette: Array<string | null> = []): TerminalColors {
  return {
    palette,
    defaultForeground: null,
    defaultBackground,
    cursorColor: null,
    mouseForeground: null,
    mouseBackground: null,
    tekForeground: null,
    tekBackground: null,
    highlightBackground: null,
    highlightForeground: null,
  }
}

test("terminalMode derives mode from refreshed background", () => {
  expect(terminalMode(terminalColors("#fbf1c7"))).toBe("light")
  expect(terminalMode(terminalColors("#1a1b26"))).toBe("dark")
})

test("terminalMode does not derive mode from ANSI slot zero", () => {
  expect(terminalMode(terminalColors(null, ["#000000"]))).toBeUndefined()
})

test("custom theme precedence follows directory order", async () => {
  await using tmp = await tmpdir()
  const global = path.join(tmp.path, "global")
  const project = path.join(tmp.path, "project")
  await mkdir(path.join(global, "themes"), { recursive: true })
  await mkdir(path.join(project, "themes"), { recursive: true })
  await writeFile(path.join(global, "themes", "custom.json"), JSON.stringify({ source: "global" }))
  await writeFile(path.join(project, "themes", "custom.json"), JSON.stringify({ source: "project" }))

  await expect(discoverThemes([global, project])).resolves.toEqual({ custom: { source: "project" } })
})
