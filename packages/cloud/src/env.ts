export class ConfigurationError extends Error {
  override name = "ConfigurationError"
}

const required = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new ConfigurationError(`Missing ${name}`)
  return value
}

export const environment = () => ({
  supabaseUrl: required("SUPABASE_URL"),
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY?.trim() || required("SUPABASE_SERVICE_ROLE_KEY"),
  appUrl: process.env.CODETUTOR_APP_URL?.trim() || "https://codetutor-app-red.vercel.app",
})

export const billingEnvironment = () => ({
  secretKey: required("STRIPE_SECRET_KEY"),
  webhookSecret: required("STRIPE_WEBHOOK_SECRET"),
  starterPrice: required("STRIPE_PRICE_STARTER"),
  proPrice: required("STRIPE_PRICE_PRO"),
  topup5Price: process.env.STRIPE_PRICE_TOPUP_5?.trim(),
  topup10Price: process.env.STRIPE_PRICE_TOPUP_10?.trim(),
  topup25Price: process.env.STRIPE_PRICE_TOPUP_25?.trim(),
  portalConfiguration: process.env.STRIPE_PORTAL_CONFIGURATION?.trim(),
})

export const billingEnabled = () =>
  ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_STARTER", "STRIPE_PRICE_PRO"].every(
    (name) => Boolean(process.env[name]?.trim()),
  )

export const topupsEnabled = () =>
  ["STRIPE_PRICE_TOPUP_5", "STRIPE_PRICE_TOPUP_10", "STRIPE_PRICE_TOPUP_25"].every((name) =>
    Boolean(process.env[name]?.trim()),
  )

export const aiGatewayToken = () =>
  process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim() || ""

export const managedAIEnabled = () => Boolean(aiGatewayToken())

export const syncEnabled = () => process.env.CODETUTOR_SYNC_ENABLED === "1"

export const allowedOrigins = () =>
  new Set(
    [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://codetutor-app-red.vercel.app",
      process.env.CODETUTOR_APP_URL?.trim() ?? "",
      ...(process.env.CODETUTOR_ALLOWED_ORIGINS?.split(",") ?? []),
    ]
      .map((value) => value.trim())
      .filter(Boolean),
  )
