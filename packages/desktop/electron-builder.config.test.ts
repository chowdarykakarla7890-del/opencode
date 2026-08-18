import { expect, test } from "bun:test"
import type { Configuration } from "electron-builder"

const channels = [
  { channel: "dev", appId: "com.codetutor.desktop.dev" },
  { channel: "beta", appId: "com.codetutor.desktop.beta" },
  { channel: "prod", appId: "com.codetutor.desktop" },
] as const

for (const channel of channels) {
  test(`uses one Linux desktop identity for ${channel.channel}`, async () => {
    const previous = process.env.CODETUTOR_CHANNEL
    process.env.CODETUTOR_CHANNEL = channel.channel

    const module = await import(`./electron-builder.config.ts?channel=${channel.channel}`)
    const config = module.default as Configuration

    if (previous === undefined) delete process.env.CODETUTOR_CHANNEL
    else process.env.CODETUTOR_CHANNEL = previous

    expect(config.appId).toBe(channel.appId)
    expect(config.extraMetadata?.desktopName).toBe(`${channel.appId}.desktop`)
    expect(config.linux?.executableName).toBe(channel.appId)
    expect(config.linux?.desktop?.entry?.StartupWMClass).toBe(channel.appId)
    expect(config.deb?.fpm).toContainEqual(expect.stringContaining(`/usr/share/metainfo/${channel.appId}.metainfo.xml`))
    expect(config.rpm?.fpm).toContainEqual(expect.stringContaining(`/usr/share/metainfo/${channel.appId}.metainfo.xml`))
  })
}

test("bundles the CLI outside the dev app archive", async () => {
  const previous = process.env.CODETUTOR_CHANNEL
  process.env.CODETUTOR_CHANNEL = "dev"
  const module = await import("./electron-builder.config.ts?cli-resource")
  const config = module.default as Configuration
  if (previous === undefined) delete process.env.CODETUTOR_CHANNEL
  else process.env.CODETUTOR_CHANNEL = previous

  expect(config.files).toContain("!resources/codetutor-cli*")
  expect(config.extraResources).toContainEqual({
    from: "resources/",
    to: "",
    filter: ["codetutor-cli*"],
  })
})

for (const channel of ["beta", "prod"] as const) {
  test(`bundles the CLI outside the ${channel} app archive`, async () => {
    const previous = process.env.CODETUTOR_CHANNEL
    process.env.CODETUTOR_CHANNEL = channel
    const module = await import(`./electron-builder.config.ts?no-cli-resource=${channel}`)
    const config = module.default as Configuration
    if (previous === undefined) delete process.env.CODETUTOR_CHANNEL
    else process.env.CODETUTOR_CHANNEL = previous

    expect(config.extraResources).toContainEqual({
      from: "resources/",
      to: "",
      filter: ["codetutor-cli*"],
    })
  })
}
