import { $ } from "bun"
import { chmod, copyFile, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const CLI_VERSION = process.env.CODETUTOR_VERSION?.replace(/^v/, "") ?? "0.1.0-beta.1"

export type Channel = "dev" | "beta" | "prod"

export function resolveChannel(): Channel {
  const raw = Bun.env.CODETUTOR_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  if (raw === "latest") return "prod"
  return "dev"
}

export const CLI_BINARIES: Array<{ rustTarget: string; package: string; os: string; cpu: string }> = [
  {
    rustTarget: "aarch64-apple-darwin",
    package: "codetutor-darwin-arm64",
    os: "darwin",
    cpu: "arm64",
  },
  {
    rustTarget: "x86_64-apple-darwin",
    package: "codetutor-darwin-x64",
    os: "darwin",
    cpu: "x64",
  },
  {
    rustTarget: "aarch64-pc-windows-msvc",
    package: "codetutor-windows-arm64",
    os: "win32",
    cpu: "arm64",
  },
  {
    rustTarget: "x86_64-pc-windows-msvc",
    package: "codetutor-windows-x64",
    os: "win32",
    cpu: "x64",
  },
  {
    rustTarget: "x86_64-unknown-linux-gnu",
    package: "codetutor-linux-x64-musl",
    os: "linux",
    cpu: "x64",
  },
  {
    rustTarget: "aarch64-unknown-linux-gnu",
    package: "codetutor-linux-arm64",
    os: "linux",
    cpu: "arm64",
  },
]

export const RUST_TARGET = Bun.env.RUST_TARGET

function nativeTarget() {
  const { platform, arch } = process
  if (platform === "darwin") return arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin"
  if (platform === "win32") return arch === "arm64" ? "aarch64-pc-windows-msvc" : "x86_64-pc-windows-msvc"
  if (platform === "linux") return arch === "arm64" ? "aarch64-unknown-linux-gnu" : "x86_64-unknown-linux-gnu"
  throw new Error(`Unsupported platform: ${platform}/${arch}`)
}

export function getCurrentCli(target = RUST_TARGET ?? nativeTarget()) {
  const binaryConfig = CLI_BINARIES.find((item) => item.rustTarget === target)
  if (!binaryConfig) throw new Error(`CLI configuration not available for target '${target}'`)

  return binaryConfig
}

export async function downloadCliToResources() {
  const cli = getCurrentCli()
  const local = join(import.meta.dir, "../../opencode/dist", cli.package, "bin", windowsify("codetutor"))
  const dest = windowsify("resources/codetutor-cli")
  if (await Bun.file(local).exists()) {
    await copyFile(local, dest)
    if (process.platform !== "win32") await chmod(dest, 0o755)
    console.log(`Copied local ${cli.package} to ${dest}`)
    return
  }
  const directory = await mkdtemp(join(tmpdir(), "codetutor-cli-"))
  try {
    await $`bun install --no-save --cwd ${directory} ${`${cli.package}@${CLI_VERSION}`} ${`--os=${cli.os}`} ${`--cpu=${cli.cpu}`}`
    await copyFile(
      join(directory, "node_modules", cli.package, "bin", cli.os === "win32" ? "codetutor.exe" : "codetutor"),
      dest,
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
  if (process.platform !== "win32") await chmod(dest, 0o755)
  console.log(`Copied ${cli.package} to ${dest}`)
}

export function windowsify(path: string) {
  if (path.endsWith(".exe")) return path
  return `${path}${process.platform === "win32" ? ".exe" : ""}`
}
