const encoder = new TextEncoder()

export const randomToken = (bytes = 32) => {
  const value = crypto.getRandomValues(new Uint8Array(bytes))
  return Buffer.from(value).toString("base64url")
}

export const randomUserCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const value = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
  return `${value.slice(0, 4)}-${value.slice(4)}`
}

export const tokenHash = async (value: string) =>
  Buffer.from(await crypto.subtle.digest("SHA-256", encoder.encode(value))).toString("hex")
