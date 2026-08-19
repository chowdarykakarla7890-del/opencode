const availableWithoutAccount = new Set([
  "account",
  "auth",
  "completion",
  "db",
  "debug",
  "generate",
  "models",
  "mcp",
  "providers",
  "pairing",
  "learn",
  "web",
  "serve",
  "attach",
  "session",
  "export",
  "import",
  "uninstall",
  "upgrade",
])

const optionsWithValue = new Set([
  "--agent",
  "--cors",
  "--hostname",
  "--log-level",
  "--model",
  "-m",
  "--port",
  "--prompt",
  "--replay-limit",
  "--session",
  "-s",
])

export const accountRequiredForArgs = (
  args: string[],
  testing = Boolean(process.env.CODETUTOR_TEST_HOME && process.env.CODETUTOR_INTERNAL_TESTING === "1"),
) => {
  if (testing) return false
  if (args.includes("--help") || args.includes("-h") || args.includes("--version") || args.includes("-v")) return false
  const command = args.find(
    (value, index) => !value.startsWith("-") && !optionsWithValue.has(args[index - 1] ?? ""),
  )
  if (!command) return false
  return !availableWithoutAccount.has(command)
}
