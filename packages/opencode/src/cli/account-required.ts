const availableWithoutAccount = new Set([
  "account",
  "auth",
  "completion",
  "db",
  "debug",
  "models",
  "providers",
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

export const accountRequiredForArgs = (args: string[]) => {
  if (process.env.CODETUTOR_ACCOUNT_REQUIRED !== "1") return false
  if (args.includes("--help") || args.includes("-h") || args.includes("--version") || args.includes("-v")) return false
  const command = args.find(
    (value, index) => !value.startsWith("-") && !optionsWithValue.has(args[index - 1] ?? ""),
  )
  if (!command) return true
  return !availableWithoutAccount.has(command)
}
