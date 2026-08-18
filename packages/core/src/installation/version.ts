declare global {
  const CODETUTOR_VERSION: string
  const CODETUTOR_CHANNEL: string
}

export const InstallationVersion = typeof CODETUTOR_VERSION === "string" ? CODETUTOR_VERSION : "local"
export const InstallationChannel = typeof CODETUTOR_CHANNEL === "string" ? CODETUTOR_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
