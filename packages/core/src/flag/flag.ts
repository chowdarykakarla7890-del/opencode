import { Config } from "effect"

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = process.env["CODETUTOR_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
const fff = process.env["CODETUTOR_DISABLE_FFF"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? truthy("CODETUTOR_EXPERIMENTAL") : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  CODETUTOR_AUTO_HEAP_SNAPSHOT: truthy("CODETUTOR_AUTO_HEAP_SNAPSHOT"),
  CODETUTOR_GIT_BASH_PATH: process.env["CODETUTOR_GIT_BASH_PATH"],
  CODETUTOR_CONFIG: process.env["CODETUTOR_CONFIG"],
  CODETUTOR_CONFIG_CONTENT: process.env["CODETUTOR_CONFIG_CONTENT"],
  CODETUTOR_DISABLE_AUTOUPDATE: truthy("CODETUTOR_DISABLE_AUTOUPDATE"),
  CODETUTOR_ALWAYS_NOTIFY_UPDATE: truthy("CODETUTOR_ALWAYS_NOTIFY_UPDATE"),
  CODETUTOR_DISABLE_PRUNE: truthy("CODETUTOR_DISABLE_PRUNE"),
  CODETUTOR_DISABLE_TERMINAL_TITLE: truthy("CODETUTOR_DISABLE_TERMINAL_TITLE"),
  CODETUTOR_SHOW_TTFD: truthy("CODETUTOR_SHOW_TTFD"),
  CODETUTOR_DISABLE_AUTOCOMPACT: truthy("CODETUTOR_DISABLE_AUTOCOMPACT"),
  CODETUTOR_DISABLE_MODELS_FETCH: truthy("CODETUTOR_DISABLE_MODELS_FETCH"),
  CODETUTOR_DISABLE_MOUSE: truthy("CODETUTOR_DISABLE_MOUSE"),
  CODETUTOR_FAKE_VCS: process.env["CODETUTOR_FAKE_VCS"],
  CODETUTOR_SERVER_PASSWORD: process.env["CODETUTOR_SERVER_PASSWORD"],
  CODETUTOR_SERVER_USERNAME: process.env["CODETUTOR_SERVER_USERNAME"],
  CODETUTOR_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("CODETUTOR_DISABLE_FFF"),

  // Experimental
  CODETUTOR_EXPERIMENTAL_FILEWATCHER: Config.boolean("CODETUTOR_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  CODETUTOR_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("CODETUTOR_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  CODETUTOR_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("CODETUTOR_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  CODETUTOR_MODELS_URL: process.env["CODETUTOR_MODELS_URL"],
  CODETUTOR_MODELS_PATH: process.env["CODETUTOR_MODELS_PATH"],
  CODETUTOR_DB: process.env["CODETUTOR_DB"],

  CODETUTOR_WORKSPACE_ID: process.env["CODETUTOR_WORKSPACE_ID"],
  CODETUTOR_EXPERIMENTAL_WORKSPACES: enabledByExperimental("CODETUTOR_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get CODETUTOR_DISABLE_PROJECT_CONFIG() {
    return truthy("CODETUTOR_DISABLE_PROJECT_CONFIG")
  },
  get CODETUTOR_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("CODETUTOR_EXPERIMENTAL_REFERENCES")
  },
  get CODETUTOR_TUI_CONFIG() {
    return process.env["CODETUTOR_TUI_CONFIG"]
  },
  get CODETUTOR_CONFIG_DIR() {
    return process.env["CODETUTOR_CONFIG_DIR"]
  },
  get CODETUTOR_PURE() {
    return truthy("CODETUTOR_PURE")
  },
  get CODETUTOR_PERMISSION() {
    return process.env["CODETUTOR_PERMISSION"]
  },
  get CODETUTOR_PLUGIN_META_FILE() {
    return process.env["CODETUTOR_PLUGIN_META_FILE"]
  },
  get CODETUTOR_CLIENT() {
    return process.env["CODETUTOR_CLIENT"] ?? "cli"
  },
}
