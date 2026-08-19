import { expect, test } from "bun:test"
import { $ } from "bun"
import path from "path"
import { fileURLToPath } from "url"
import { keyringCompiledPlugin } from "../../script/keyring-compiled"

test("compiled split binary loads the operating system keyring", async () => {
  await using tmp = await import("../fixture/fixture").then((x) => x.tmpdir())
  const entrypoint = path.join(tmp.path, "keyring.ts")
  const outfile = path.join(tmp.path, process.platform === "win32" ? "keyring.exe" : "keyring")
  await Bun.write(
    entrypoint,
    `import { Entry } from ${JSON.stringify(fileURLToPath(import.meta.resolve("@napi-rs/keyring")))}\nconsole.log(typeof Entry)\n`,
  )

  const result = await Bun.build({
    entrypoints: [entrypoint],
    plugins: [keyringCompiledPlugin],
    splitting: true,
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      autoloadTsconfig: false,
      autoloadPackageJson: false,
      outfile,
    },
  })

  expect(result.success).toBe(true)
  expect((await $`${outfile}`.text()).trim()).toBe("function")
})
