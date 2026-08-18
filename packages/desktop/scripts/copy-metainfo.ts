import { resolveChannel } from "./utils"

const arg = process.argv[2]
const channel = arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

const appId = channel === "prod" ? "com.codetutor.desktop" : `com.codetutor.desktop.${channel}`
const productName = channel === "prod" ? "CodeTutor" : `CodeTutor ${channel.charAt(0).toUpperCase() + channel.slice(1)}`
const summary = `AI coding tutor with local lessons${channel !== "prod" ? ` (${channel})` : ""}`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${appId}</id>

  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>

  <name>${productName}</name>
  <summary>${summary}</summary>

  <developer id="com.codetutor">
    <name>CodeTutor contributors</name>
  </developer>

  <description>
    <p>
      CodeTutor teaches JavaScript and TypeScript inside real repositories with deterministic lesson checks.
    </p>
  </description>

  <launchable type="desktop-id">${appId}.desktop</launchable>

  <content_rating type="oars-1.1" />

  <url type="bugtracker">https://github.com/chowdarykakarla7890-del/opencode/issues</url>
  <url type="homepage">https://codetutor-docs.vercel.app</url>
  <url type="vcs-browser">https://github.com/chowdarykakarla7890-del/opencode</url>
</component>
`

await Bun.write(`resources/${appId}.metainfo.xml`, xml)
console.log(`Generated metainfo for ${channel} at resources/${appId}.metainfo.xml`)
