export const learnerLevels = ["beginner", "intermediate", "advanced"] as const
export const teachingStyles = ["guided", "collaborative", "concise"] as const
export const learningPaces = ["slow", "balanced", "fast"] as const

const text = (value: unknown, maximum: number) => {
  if (value === null) return null
  if (typeof value !== "string") return undefined
  const result = value.trim()
  if (!result || result.length > maximum) return undefined
  return result
}

const textList = (value: unknown) => {
  if (!Array.isArray(value) || value.length > 30) return undefined
  const result = value.map((item) => text(item, 80))
  if (result.some((item) => item === undefined || item === null)) return undefined
  return [...new Set(result as string[])]
}

const object = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  if (JSON.stringify(value).length > 8_000) return undefined
  return value as Record<string, unknown>
}

export const profileUpdate = (input: Record<string, unknown>) => {
  const output: Record<string, unknown> = {}
  const optionalText = ["display_name", "avatar_url", "ide", "primary_model", "helper_model"] as const
  for (const key of optionalText) {
    if (!(key in input)) continue
    const value = text(input[key], key === "avatar_url" ? 2_000 : 160)
    if (value === undefined) return null
    output[key] = value
  }
  const lists = ["goals", "languages", "frameworks"] as const
  for (const key of lists) {
    if (!(key in input)) continue
    const value = textList(input[key])
    if (!value) return null
    output[key] = value
  }
  if ("learner_level" in input) {
    if (!learnerLevels.includes(input.learner_level as (typeof learnerLevels)[number])) return null
    output.learner_level = input.learner_level
  }
  if ("teaching_style" in input) {
    if (!teachingStyles.includes(input.teaching_style as (typeof teachingStyles)[number])) return null
    output.teaching_style = input.teaching_style
  }
  if ("pace" in input) {
    if (!learningPaces.includes(input.pace as (typeof learningPaces)[number])) return null
    output.pace = input.pace
  }
  for (const key of ["helper_enabled", "diagnostics_opt_in"] as const) {
    if (!(key in input)) continue
    if (typeof input[key] !== "boolean") return null
    output[key] = input[key]
  }
  for (const key of ["accessibility", "notification_preferences"] as const) {
    if (!(key in input)) continue
    const value = object(input[key])
    if (!value) return null
    output[key] = value
  }
  if ("minimum_age_confirmed" in input) {
    if (input.minimum_age_confirmed !== true) return null
    output.minimum_age_confirmed_at = new Date().toISOString()
  }
  return Object.keys(output).length ? output : null
}
