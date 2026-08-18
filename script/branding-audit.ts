#!/usr/bin/env bun

const tracked = Bun.spawnSync({
  cmd: ["git", "ls-files", "-co", "--exclude-standard", "-z"],
  stdout: "pipe",
  stderr: "inherit",
})

if (tracked.exitCode !== 0) process.exit(tracked.exitCode)

const rules = [
  { label: "upstream product name", pattern: /OpenCode/g },
  { label: "upstream product URL", pattern: /opencode\.ai/g },
  {
    label: "old CLI command",
    pattern:
      /\bopencode\s+(?:completion|acp|mcp|attach|run|debug|providers|auth|agent|upgrade|uninstall|serve|web|models|stats|export|import|pr|session|plugin|db|learn|github)\b/g,
  },
  { label: "old desktop protocol", pattern: /opencode:\/\//g },
  { label: "old protocol header", pattern: /x-opencode-/g },
  { label: "old local hostname", pattern: /opencode\.local/g },
  { label: "old config filename", pattern: /(?:^|[/`'"\s])opencode\.jsonc?(?:$|[/`'"\s])/g },
  { label: "old project directory", pattern: /(?:^|[/`'"\s])\.opencode(?:$|[/`'"\s])/g },
  { label: "old environment namespace", pattern: /\bOPENCODE_(?!API_KEY\b)[A-Z0-9_]+/g },
  { label: "upstream release endpoint", pattern: /api\.github\.com\/repos\/anomalyco\/opencode\/releases/g },
] as const

function allowed(file: string, line: string, label: (typeof rules)[number]["label"]) {
  if (file === "script/branding-audit.ts") return true
  if (label === "upstream product name") {
    if (line.includes("OpenCode Zen")) return true
    if (file === "NOTICE" || file === "LICENSE" || file.endsWith("/NOTICE") || file.endsWith("/LICENSE")) return true
    if (file === "packages/core/src/plugin/provider/opencode.ts") return true
    if (
      /^packages\/app\/src\/(?:context\/(?:server-sdk|server-session|server-session-v2-reducer)|utils\/server)/.test(
        file,
      ) && /\bOpenCode(?:Event|Client)?\b/.test(line)
    )
      return true
  }
  if (label === "upstream product URL") {
    if (!line.includes("/zen")) return false
    if (/^packages\/web\/src\/content\/docs\/(?:[^/]+\/)?zen\.mdx$/.test(file)) return true
    if (file === "packages/web/config.mjs") return true
    if (file.startsWith("packages/app/src/i18n/")) return true
    if (file === "packages/app/src/components/dialog-connect-provider.tsx") return true
    if (file === "packages/tui/src/component/dialog-provider.tsx") return true
    if (file === "packages/opencode/src/cli/cmd/providers.ts") return true
    if (file === "packages/web/src/content/docs/providers.mdx" && line.includes("OpenCode Zen")) return true
  }
  return false
}

const failures: string[] = []
const files = tracked.stdout.toString().split("\0").filter(Boolean)
for (const file of files) {
  const blob = Bun.file(file)
  if (!(await blob.exists())) continue
  if ((await blob.size) > 2_000_000) continue
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (bytes.includes(0)) continue
  const text = new TextDecoder().decode(bytes)
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    for (const rule of rules) {
      rule.pattern.lastIndex = 0
      if (!rule.pattern.test(line) || allowed(file, line, rule.label)) continue
      failures.push(`${file}:${index + 1}: ${rule.label}: ${line.trim()}`)
    }
  }
}

if (failures.length) {
  console.error(`CodeTutor branding audit failed with ${failures.length} violation(s):`)
  console.error(failures.slice(0, 100).join("\n"))
  if (failures.length > 100) console.error(`...and ${failures.length - 100} more`)
  process.exit(1)
}

console.log(`CodeTutor branding audit passed (${files.length} files checked)`)
