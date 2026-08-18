#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@opencode-ai/script"
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)
const dryRun = process.env.CODETUTOR_DRY_RUN === "1"

async function published(name: string, version: string) {
  if (dryRun) return false
  return (await $`npm view ${name}@${version} version`.nothrow()).exitCode === 0
}

async function publish(dir: string, name: string, version: string) {
  // GitHub artifact downloads can drop the executable bit, and Docker uses the
  // unpacked dist binaries directly rather than the published tarball.
  if (process.platform !== "win32") await $`chmod -R 755 .`.cwd(dir)
  if (await published(name, version)) {
    console.log(`already published ${name}@${version}`)
    return
  }
  await $`bun pm pack`.cwd(dir)
  if (dryRun) return
  await publishTarball(dir)
  await Bun.sleep(20_000)
}

async function publishTarball(dir: string, attempt = 1): Promise<void> {
  const result = await $`npm publish *.tgz --provenance --access public --tag ${Script.channel}`.cwd(dir).nothrow()
  if (result.exitCode === 0) return

  const details = new TextDecoder().decode(result.stderr)
  const retryable = /E429|Too Many Requests|rate limit/i.test(details)
  if (!retryable || attempt === 5) throw new Error(details || `npm publish failed with exit code ${result.exitCode}`)

  await Bun.sleep(attempt * 60_000)
  return publishTarball(dir, attempt + 1)
}

const binaries: Record<string, string> = {}
for (const filepath of new Bun.Glob("*/package.json").scanSync({ cwd: "./dist" })) {
  const platform = await Bun.file(`./dist/${filepath}`).json()
  if (platform.name === pkg.name) continue
  binaries[platform.name] = platform.version
}
console.log("binaries", binaries)
const version = Object.values(binaries)[0]

await $`mkdir -p ./dist/${pkg.name}`
await $`mkdir -p ./dist/${pkg.name}/bin`
await $`cp ./script/postinstall.mjs ./dist/${pkg.name}/postinstall.mjs`
await Bun.file(`./dist/${pkg.name}/LICENSE`).write(await Bun.file("../../LICENSE").text())
await Bun.file(`./dist/${pkg.name}/NOTICE`).write(await Bun.file("../../NOTICE").text())
await Bun.file(`./dist/${pkg.name}/bin/${pkg.name}.exe`).write(
  [
    `echo "Error: ${pkg.name}'s postinstall script was not run." >&2`,
    'echo "" >&2',
    'echo "This occurs when using --ignore-scripts during installation, or when using a" >&2',
    'echo "package manager like pnpm that does not run postinstall scripts by default." >&2',
    'echo "" >&2',
    'echo "To fix this, run the postinstall script manually:" >&2',
    `echo "  cd node_modules/${pkg.name} && node postinstall.mjs" >&2`,
    'echo "" >&2',
    `echo "Or reinstall ${pkg.name} without the --ignore-scripts flag." >&2`,
    "exit 1",
    "",
  ].join("\n"),
)

await Bun.file(`./dist/${pkg.name}/package.json`).write(
  JSON.stringify(
    {
      name: pkg.name,
      bin: {
        [pkg.name]: `./bin/${pkg.name}.exe`,
      },
      scripts: {
        postinstall: "node ./postinstall.mjs",
      },
      files: ["bin", "postinstall.mjs", "LICENSE", "NOTICE"],
      version: version,
      description: pkg.description,
      repository: pkg.repository,
      homepage: pkg.homepage,
      bugs: pkg.bugs,
      license: pkg.license,
      os: ["darwin", "linux", "win32"],
      cpu: ["arm64", "x64"],
      optionalDependencies: binaries,
    },
    null,
    2,
  ),
)

for (const [name, version] of Object.entries(binaries)) {
  await Bun.file(`./dist/${name}/NOTICE`).write(await Bun.file("../../NOTICE").text())
  await publish(`./dist/${name}`, name, version)
}
await publish(`./dist/${pkg.name}`, pkg.name, version)
