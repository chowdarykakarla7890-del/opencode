import { registerCustomTheme } from "@pierre/diffs"
import { CodeTutorTheme } from "./marked-theme"

let registered = false

export function registerCodeTutorTheme() {
  if (registered) return
  registered = true
  registerCustomTheme("CodeTutor", () => Promise.resolve(CodeTutorTheme))
}
