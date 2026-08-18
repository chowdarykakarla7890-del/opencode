import path from "node:path"
import { fileURLToPath } from "node:url"

import type { Configuration } from "electron-builder"

const packageDir = path.dirname(fileURLToPath(import.meta.url))

const metainfoFpm = (appId: string) =>
  `${path.join(packageDir, "resources", `${appId}.metainfo.xml`)}=/usr/share/metainfo/${appId}.metainfo.xml`

const channel = (() => {
  const raw = process.env.CODETUTOR_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  if (raw === "latest") return "prod"
  return "dev"
})()

const APP_IDS = {
  dev: "com.codetutor.desktop.dev",
  beta: "com.codetutor.desktop.beta",
  prod: "com.codetutor.desktop",
} as const

const getBase = (appId: string): Configuration => ({
  artifactName: "codetutor-desktop-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  // Linux launchers are .desktop files, so this is the desktop file name,
  // not just the app id. For prod, app id "com.codetutor.desktop" becomes
  // "com.codetutor.desktop.desktop".
  // https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html
  // https://www.electron.build/docs/linux/
  extraMetadata: {
    desktopName: `${appId}.desktop`,
  },
  files: ["out/**/*", "resources/**/*", "!resources/codetutor-cli*"],
  extraResources: [
    {
      from: "resources/",
      to: "",
      filter: ["codetutor-cli*"],
    },
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: `resources/icons/icon.icns`,
    hardenedRuntime: false,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    notarize: false,
    target: ["dmg", "zip"],
  },
  dmg: {
    sign: false,
  },
  protocols: {
    name: "CodeTutor",
    schemes: ["codetutor"],
  },
  win: {
    icon: `resources/icons/icon.ico`,
    target: ["nsis"],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    installerIcon: `resources/icons/icon.ico`,
    installerHeaderIcon: `resources/icons/icon.ico`,
  },
  linux: {
    icon: `resources/icons`,
    category: "Development",
    executableName: appId,
    desktop: {
      entry: {
        // Match the installed .desktop file and hicolor icon basename so
        // Linux shells can associate the running Electron window with its launcher.
        StartupWMClass: appId,
      },
    },
    target: ["AppImage", "deb", "rpm"],
  },
})

function getConfig() {
  const appId = APP_IDS[channel]
  const base = getBase(appId)

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId,
        productName: "CodeTutor Dev",
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "codetutor-dev", fpm: [metainfoFpm(appId)] },
      }
    }
    case "beta": {
      return {
        ...base,
        appId,
        productName: "CodeTutor Beta",
        protocols: { name: "CodeTutor Beta", schemes: ["codetutor"] },
        publish: { provider: "github", owner: "chowdarykakarla7890-del", repo: "opencode", channel: "beta" },
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "codetutor-beta", fpm: [metainfoFpm(appId)] },
      }
    }
    case "prod": {
      return {
        ...base,
        appId,
        productName: "CodeTutor",
        protocols: { name: "CodeTutor", schemes: ["codetutor"] },
        publish: { provider: "github", owner: "chowdarykakarla7890-del", repo: "opencode", channel: "latest" },
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "codetutor", fpm: [metainfoFpm(appId)] },
      }
    }
  }
}

export default getConfig()
