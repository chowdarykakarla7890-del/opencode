import { createClient, type AuthChangeEvent, type Session, type SupabaseClient } from "@supabase/supabase-js"
import { createEffect, createSignal, For, onCleanup, onMount, Show, type ParentProps } from "solid-js"
import { usePlatform } from "@/context/platform"
import { useLanguage } from "@/context/language"

const accountUrl = () => import.meta.env.VITE_CODETUTOR_ACCOUNT_URL?.trim() || "https://codetutor-cloud.vercel.app"
const enabled = () => import.meta.env.VITE_CODETUTOR_ACCOUNT_ENABLED !== "0"
const verifiedKey = "codetutor.account.dat:verified"

const client = (storage?: {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}) => {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !key) return null
  return createClient(url, key, {
    auth: {
      detectSessionInUrl: false,
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      ...(storage ? { storage } : {}),
    },
  })
}

const authCallback = (desktop: boolean) => {
  if (desktop) return "codetutor://auth/callback"
  if (location.pathname === "/device") return location.href
  return `${location.origin}/auth/callback`
}

function AccountSetupRequired(props: { onLocal: () => void }) {
  return (
    <main class="min-h-screen bg-background-base text-text-strong flex items-center justify-center p-6">
      <section class="w-full max-w-md border border-border-weak-base rounded-lg bg-surface-base p-6">
        <p class="text-12-medium uppercase tracking-wider text-text-weak">CodeTutor account</p>
        <h1 class="mt-3 text-20-medium">Account service setup required</h1>
        <p class="mt-2 text-14-regular text-text-base">
          Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable managed AI and account sync.
        </p>
        <button
          type="button"
          onClick={props.onLocal}
          class="mt-6 h-10 w-full rounded-md border border-border-base text-14-medium hover:bg-surface-raised-base-hover"
        >
          Continue with local learning
        </button>
      </section>
    </main>
  )
}

function SignIn(props: { supabase: SupabaseClient; onLocal: () => void }) {
  const platform = usePlatform()
  const language = useLanguage()
  const [email, setEmail] = createSignal("")
  const [message, setMessage] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [ageConfirmed, setAgeConfirmed] = createSignal(false)
  const desktop = platform.platform === "desktop"

  const magicLink = async (event: SubmitEvent) => {
    event.preventDefault()
    if (!ageConfirmed()) return
    sessionStorage.setItem("codetutor.minimum-age-confirmed", "1")
    setBusy(true)
    const result = await props.supabase.auth.signInWithOtp({
      email: email().trim(),
      options: { emailRedirectTo: authCallback(desktop) },
    })
    setBusy(false)
    setMessage(result.error?.message ?? language.t("account.signIn.emailSent"))
  }

  const oauth = async (provider: "github" | "google") => {
    if (!ageConfirmed()) return
    sessionStorage.setItem("codetutor.minimum-age-confirmed", "1")
    setBusy(true)
    const result = await props.supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authCallback(desktop), skipBrowserRedirect: desktop },
    })
    setBusy(false)
    if (result.error) return setMessage(result.error.message)
    if (desktop && result.data.url) platform.openExternal(result.data.url)
  }

  return (
    <main class="min-h-screen bg-background-base text-text-strong flex items-center justify-center p-6">
      <section class="w-full max-w-md border border-border-weak-base rounded-lg bg-surface-base p-6 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-md bg-surface-brand-base text-text-on-brand-strong flex items-center justify-center text-14-medium">CT</div>
          <div>
            <p class="text-12-medium uppercase tracking-wider text-text-weak">CodeTutor</p>
            <h1 class="text-20-medium">{language.t("account.signIn.title")}</h1>
          </div>
        </div>
        <p class="mt-4 text-14-regular text-text-base">
          {language.t("account.signIn.description")}
        </p>
        <button
          type="button"
          disabled={busy() || !ageConfirmed()}
          onClick={() => void oauth("github")}
          class="mt-6 h-10 w-full rounded-md bg-surface-brand-base text-text-on-brand-strong text-14-medium disabled:opacity-50"
        >
          {language.t("account.signIn.github")}
        </button>
        <button
          type="button"
          disabled={busy() || !ageConfirmed()}
          onClick={() => void oauth("google")}
          class="mt-3 h-10 w-full rounded-md border border-border-base text-14-medium hover:bg-surface-raised-base-hover disabled:opacity-50"
        >
          {language.t("account.signIn.google")}
        </button>
        <div class="my-4 flex items-center gap-3 text-12-regular text-text-weak">
          <span class="h-px flex-1 bg-border-weak-base" /> {language.t("account.signIn.emailDivider")} <span class="h-px flex-1 bg-border-weak-base" />
        </div>
        <form class="mt-6 flex flex-col gap-3" onSubmit={magicLink}>
          <label class="text-12-medium text-text-base" for="codetutor-account-email">{language.t("account.signIn.email")}</label>
          <input
            id="codetutor-account-email"
            type="email"
            autocomplete="email"
            required
            value={email()}
            onInput={(event) => setEmail(event.currentTarget.value)}
            class="h-10 px-3 rounded-md border border-border-base bg-background-base text-14-regular outline-none focus:border-border-selected"
            placeholder="you@example.com"
          />
          <button
            type="submit"
            disabled={busy() || !email().trim() || !ageConfirmed()}
            class="h-10 rounded-md bg-surface-brand-base text-text-on-brand-strong text-14-medium disabled:opacity-50"
          >
            {language.t("account.signIn.emailAction")}
          </button>
        </form>
        <label class="mt-4 flex items-start gap-2 text-12-regular text-text-base">
          <input
            type="checkbox"
            checked={ageConfirmed()}
            onChange={(event) => setAgeConfirmed(event.currentTarget.checked)}
            class="mt-0.5"
          />
          <span>I confirm that I am at least 16 years old and agree to the Terms and Privacy Policy.</span>
        </label>
        <Show when={message()}>
          <p role="status" class="mt-4 text-12-regular text-text-base">{message()}</p>
        </Show>
        <button
          type="button"
          onClick={props.onLocal}
          class="mt-5 h-10 w-full rounded-md border border-border-base text-14-medium hover:bg-surface-raised-base-hover"
        >
          {language.t("account.signIn.local")}
        </button>
      </section>
    </main>
  )
}

function DeviceApproval(props: { session: Session }) {
  const query = new URLSearchParams(location.search)
  const [userCode, setUserCode] = createSignal(query.get("user_code") ?? "")
  const [message, setMessage] = createSignal("")
  const [busy, setBusy] = createSignal(false)

  const approve = async (event: SubmitEvent) => {
    event.preventDefault()
    setBusy(true)
    const response = await fetch(`${accountUrl()}/auth/device/approve`, {
      method: "POST",
      headers: { authorization: `Bearer ${props.session.access_token}`, "content-type": "application/json" },
      body: JSON.stringify({ user_code: userCode().trim() }),
    }).catch(() => null)
    setBusy(false)
    if (!response) return setMessage("Could not reach the CodeTutor account service.")
    if (!response.ok) return setMessage("That code is invalid or expired. Start login again from the CLI.")
    setMessage("CLI approved. You can return to your terminal.")
  }

  return (
    <main class="min-h-screen bg-background-base text-text-strong flex items-center justify-center p-6">
      <section class="w-full max-w-md border border-border-weak-base rounded-lg bg-surface-base p-6">
        <p class="text-12-medium uppercase tracking-wider text-text-weak">CodeTutor CLI</p>
        <h1 class="mt-3 text-20-medium">Approve terminal sign-in</h1>
        <p class="mt-2 text-14-regular text-text-base">
          Only approve a code you just requested with <code>codetutor account login</code>.
        </p>
        <form class="mt-6 flex flex-col gap-3" onSubmit={approve}>
          <label class="text-12-medium text-text-base" for="codetutor-device-code">Device code</label>
          <input
            id="codetutor-device-code"
            value={userCode()}
            onInput={(event) => setUserCode(event.currentTarget.value.toUpperCase())}
            class="h-11 px-3 rounded-md border border-border-base bg-background-base font-mono tracking-widest outline-none focus:border-border-selected"
            placeholder="ABCD-EFGH"
          />
          <button
            type="submit"
            disabled={busy() || !userCode().trim()}
            class="h-10 rounded-md bg-surface-brand-base text-text-on-brand-strong text-14-medium disabled:opacity-50"
          >
            Approve CodeTutor CLI
          </button>
        </form>
        <Show when={message()}>
          <p role="status" class="mt-4 text-12-regular text-text-base">{message()}</p>
        </Show>
      </section>
    </main>
  )
}

function AccountHome(props: { session: Session; supabase: SupabaseClient }) {
  const language = useLanguage()
  const [busy, setBusy] = createSignal(false)
  const [message, setMessage] = createSignal("")
  const [entitlement, setEntitlement] = createSignal<{
    plan: string
    billing: boolean
    topups: boolean
    managed_ai: boolean
    period: { start: string; end: string }
    credit: { remainingNanos: number; expiresAt: string | null }
    subscription: { current_period_end?: string; cancel_at_period_end?: boolean } | null
    allowance: {
      name: string
      price_monthly: number
      limits: {
        requests_monthly: number
        tokens_monthly: number
        spend_monthly_usd: number
        requests_per_minute: number
        concurrent_requests: number
        max_output_tokens: number
      }
    }
  } | null>(null)
  const [usage, setUsage] = createSignal<{
    period_start: string
    period_end: string
    usage: { request_count: number; input_tokens: number; output_tokens: number; spend_usd: number }
    remaining: { requests: number; tokens: number; spend_usd: number }
    credit: { remainingNanos: number; expiresAt: string | null }
  } | null>(null)
  const [profile, setProfile] = createSignal<{
    display_name: string | null
    learner_level: "beginner" | "intermediate" | "advanced"
    primary_model: string | null
    minimum_age_confirmed_at: string | null
  } | null>(null)
  const [sessions, setSessions] = createSignal<{
    current_session_id: string | null
    sessions: {
      id: string
      client_type: string
      device_name: string | null
      platform: string | null
      last_seen_at: string
      revoked_at: string | null
    }[]
  } | null>(null)
  const [serviceKeys, setServiceKeys] = createSignal<{
    id: string
    name: string
    token_prefix: string
    scopes: string[]
    model_allowlist: string[]
    expires_at: string
    revoked_at: string | null
  }[]>([])
  const [serviceKeyName, setServiceKeyName] = createSignal("")
  const [serviceKeySecret, setServiceKeySecret] = createSignal("")
  const [deleteConfirmation, setDeleteConfirmation] = createSignal("")
  const [totpFactor, setTotpFactor] = createSignal<{ id: string; status: string }>()
  const [totpEnrollment, setTotpEnrollment] = createSignal<{ id: string; qr: string; secret: string }>()
  const [totpCode, setTotpCode] = createSignal("")
  const [assuranceLevel, setAssuranceLevel] = createSignal<string>()
  const [recoveryCodes, setRecoveryCodes] = createSignal<string[]>([])
  const [recoveryCode, setRecoveryCode] = createSignal("")
  const [pairingUrl, setPairingUrl] = createSignal("http://127.0.0.1:4096")
  const [pairingCode, setPairingCode] = createSignal("")
  const [localPairing, setLocalPairing] = createSignal<{ id: string; email: string; origin: string; expires_at: string }>()

  const accountFetch = (path: string, init?: RequestInit) =>
    fetch(`${accountUrl()}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${props.session.access_token}`,
        "content-type": "application/json",
        ...init?.headers,
      },
    })

  const refresh = async () => {
    const [nextEntitlement, nextUsage, nextProfile, nextSessions, nextServiceKeys] = await Promise.all([
      accountFetch("/api/entitlements"),
      accountFetch("/api/usage"),
      accountFetch("/api/profile"),
      accountFetch("/api/account/sessions"),
      accountFetch("/api/account/service-keys"),
    ]).catch(() => [])
    if (nextEntitlement?.ok) setEntitlement(await nextEntitlement.json())
    if (nextUsage?.ok) setUsage(await nextUsage.json())
    if (nextProfile?.ok) {
      const result: { profile: NonNullable<ReturnType<typeof profile>> } = await nextProfile.json()
      setProfile(result.profile)
      if (!result.profile.minimum_age_confirmed_at && sessionStorage.getItem("codetutor.minimum-age-confirmed") === "1") {
        await accountFetch("/api/profile", {
          method: "PATCH",
          body: JSON.stringify({ minimum_age_confirmed: true }),
        })
        sessionStorage.removeItem("codetutor.minimum-age-confirmed")
      }
    }
    if (nextSessions?.ok) setSessions(await nextSessions.json())
    if (nextServiceKeys?.ok) {
      const result: { service_keys: ReturnType<typeof serviceKeys> } = await nextServiceKeys.json()
      setServiceKeys(result.service_keys)
    }
    const factors = await props.supabase.auth.mfa.listFactors()
    setTotpFactor(factors.data?.totp[0])
    const assurance = await props.supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setAssuranceLevel(assurance.data?.currentLevel ?? undefined)
    await refreshPairing()
  }

  onMount(() => {
    void refresh().then(() => {
      const query = new URLSearchParams(location.search)
      const action = query.get("action")
      const plan = query.get("plan")
      const pack = query.get("pack")
      if (action === "upgrade" && (plan === "starter" || plan === "pro")) {
        void billing("/api/billing/change-plan", { plan })
      }
      if (action === "topup" && (pack === "5" || pack === "10" || pack === "25")) {
        void billing("/api/billing/topup", { pack })
      }
      if (action === "billing") void billing("/api/billing/portal")
      if (action === "export") void exportAccount()
    })
  })

  const billing = async (path: string, body?: Record<string, string>) => {
    setBusy(true)
    setMessage("")
    const response = await accountFetch(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }).catch(
      () => null,
    )
    setBusy(false)
    if (!response) return setMessage("Could not reach CodeTutor billing.")
    const result: { url?: string; error?: string } = await response.json().catch(() => ({}))
    if (result.error === "reauthentication_required") {
      return setMessage("Sign out and sign in again to approve this billing change.")
    }
    if (!response.ok || !result.url) return setMessage(result.error ?? "Billing is not available yet.")
    location.assign(result.url)
  }

  const signOut = async () => {
    setBusy(true)
    await props.supabase.auth.signOut()
    localStorage.removeItem(verifiedKey)
    setBusy(false)
  }

  const updateLevel = async (level: "beginner" | "intermediate" | "advanced") => {
    setBusy(true)
    const response = await accountFetch("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ learner_level: level }),
    }).catch(() => null)
    setBusy(false)
    if (!response?.ok) return setMessage("Could not update the tutor profile.")
    const result: { profile: ReturnType<typeof profile> } = await response.json()
    setProfile(result.profile)
  }

  const revokeSession = async (sessionID: string) => {
    setBusy(true)
    const response = await accountFetch("/api/account/sessions", {
      method: "DELETE",
      body: JSON.stringify({ session_id: sessionID }),
    }).catch(() => null)
    setBusy(false)
    if (!response?.ok) return setMessage("Could not revoke that session.")
    await refresh()
  }

  const createServiceKey = async () => {
    if (!serviceKeyName().trim()) return
    setBusy(true)
    const response = await accountFetch("/api/account/service-keys", {
      method: "POST",
      body: JSON.stringify({
        name: serviceKeyName().trim(),
        scopes: ["managed_ai:invoke", "models:read", "usage:read"],
        model_allowlist: [],
        request_limit: 500,
        credit_budget_usd: 5,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    }).catch(() => null)
    setBusy(false)
    const result: { secret?: string; error?: string } = await response?.json().catch(() => ({})) ?? {}
    if (!response?.ok || !result.secret) {
      return setMessage(
        result.error === "reauthentication_required"
          ? "Sign in again and complete MFA before creating a service key."
          : result.error ?? "Could not create the service key.",
      )
    }
    setServiceKeySecret(result.secret)
    setServiceKeyName("")
    await refresh()
  }

  const revokeServiceKey = async (id: string) => {
    setBusy(true)
    const response = await accountFetch("/api/account/service-keys", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }).catch(() => null)
    setBusy(false)
    if (!response?.ok) return setMessage("Sign in again and complete MFA before revoking a service key.")
    await refresh()
  }

  const exportAccount = async () => {
    setBusy(true)
    const response = await accountFetch("/api/account/export").catch(() => null)
    setBusy(false)
    if (!response?.ok) return setMessage("Sign in again before exporting your account data.")
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `codetutor-account-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const deleteAccount = async () => {
    if (deleteConfirmation() !== "DELETE") return
    setBusy(true)
    const response = await accountFetch("/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ confirm: deleteConfirmation() }),
    }).catch(() => null)
    setBusy(false)
    const result: { scheduled_for?: string; error?: string } = await response?.json().catch(() => ({})) ?? {}
    if (!response?.ok) return setMessage(result.error ?? "Could not schedule account deletion.")
    setMessage(`Deletion scheduled for ${result.scheduled_for}. You have seven days to contact support and recover it.`)
  }

  const enrollTotp = async () => {
    setBusy(true)
    const result = await props.supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "CodeTutor" })
    setBusy(false)
    if (result.error) return setMessage(result.error.message)
    setTotpEnrollment({ id: result.data.id, qr: result.data.totp.qr_code, secret: result.data.totp.secret })
  }

  const verifyTotp = async () => {
    const factorID = totpEnrollment()?.id ?? totpFactor()?.id
    if (!factorID || totpCode().length !== 6) return
    setBusy(true)
    const result = await props.supabase.auth.mfa.challengeAndVerify({ factorId: factorID, code: totpCode() })
    setBusy(false)
    if (result.error) return setMessage(result.error.message)
    setTotpCode("")
    setTotpEnrollment()
    setMessage("MFA verified for this session.")
    await refresh()
  }

  const generateRecoveryCodes = async () => {
    setBusy(true)
    const response = await accountFetch("/api/account/recovery-codes", {
      method: "POST",
      body: JSON.stringify({ action: "generate" }),
    }).catch(() => null)
    setBusy(false)
    const result: { recovery_codes?: string[]; error?: string } = await response?.json().catch(() => ({})) ?? {}
    if (!response?.ok || !result.recovery_codes) return setMessage(result.error ?? "Verify MFA first.")
    setRecoveryCodes(result.recovery_codes)
  }

  const recoverMfa = async () => {
    if (!recoveryCode().trim()) return
    setBusy(true)
    const response = await accountFetch("/api/account/recovery-codes", {
      method: "POST",
      body: JSON.stringify({ action: "recover", code: recoveryCode().trim() }),
    }).catch(() => null)
    setBusy(false)
    if (!response?.ok) return setMessage("That recovery code is invalid or expired.")
    setMessage("MFA was reset and device sessions were revoked. Sign in again, then enroll a new authenticator.")
    await props.supabase.auth.signOut()
  }

  const pairLocalServer = async () => {
    if (!URL.canParse(pairingUrl())) return setMessage("Enter a valid loopback server URL.")
    const server = new URL(pairingUrl())
    if (server.protocol !== "http:" || !["localhost", "127.0.0.1", "::1"].includes(server.hostname)) {
      return setMessage("Hosted web pairing is loopback-only.")
    }
    setBusy(true)
    const response = await fetch(new URL("/api/local/pairing/request", server), {
      method: "POST",
      headers: { authorization: `Bearer ${props.session.access_token}`, "content-type": "application/json" },
      targetAddressSpace: "loopback",
    } as RequestInit & { targetAddressSpace: "loopback" }).catch(() => null)
    setBusy(false)
    const result: { request_id?: string; code?: string; error?: string } = await response?.json().catch(() => ({})) ?? {}
    if (!response?.ok || !result.request_id || !result.code) {
      return setMessage(result.error ?? "Start the local CodeTutor server, then try pairing again.")
    }
    setPairingCode(result.code)
    const requestID = result.request_id
    const deadline = Date.now() + 10 * 60 * 1000
    const poll = async () => {
      if (Date.now() >= deadline) return setMessage("Pairing code expired. Start again.")
      const status = await fetch(new URL(`/api/local/pairing/status?request_id=${encodeURIComponent(requestID)}`, server), {
        targetAddressSpace: "loopback",
      } as RequestInit & { targetAddressSpace: "loopback" }).catch(() => null)
      const value: { status?: string; token?: string } = await status?.json().catch(() => ({})) ?? {}
      if (value.status === "approved" && value.token) {
        const authToken = btoa(`pair:${value.token}`)
        sessionStorage.setItem(
          "codetutor.local-pairing",
          JSON.stringify({ url: server.origin, token: value.token }),
        )
        location.assign(`/?server_url=${encodeURIComponent(server.origin)}&auth_token=${encodeURIComponent(authToken)}`)
        return
      }
      if (value.status === "expired") return setMessage("Pairing code expired. Start again.")
      setTimeout(() => void poll(), 2_000)
    }
    setTimeout(() => void poll(), 2_000)
  }

  const pairingCredential = () => {
    const stored = sessionStorage.getItem("codetutor.local-pairing")
    if (!stored) return null
    const value: unknown = (() => {
      try {
        return JSON.parse(stored)
      } catch {
        sessionStorage.removeItem("codetutor.local-pairing")
        return null
      }
    })()
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    if (typeof record.url !== "string" || typeof record.token !== "string") return null
    return { url: record.url, token: record.token }
  }

  const refreshPairing = async () => {
    const credential = pairingCredential()
    if (!credential) return
    const response = await fetch(new URL("/api/local/pairing/current", credential.url), {
      headers: { authorization: `Basic ${btoa(`pair:${credential.token}`)}` },
      targetAddressSpace: "loopback",
    } as RequestInit & { targetAddressSpace: "loopback" }).catch(() => null)
    if (!response?.ok) return
    const result: { pairing?: ReturnType<typeof localPairing> } = await response.json()
    setLocalPairing(result.pairing)
  }

  const revokePairing = async () => {
    const credential = pairingCredential()
    if (!credential) return
    setBusy(true)
    const response = await fetch(new URL("/api/local/pairing/current", credential.url), {
      method: "DELETE",
      headers: { authorization: `Basic ${btoa(`pair:${credential.token}`)}` },
      targetAddressSpace: "loopback",
    } as RequestInit & { targetAddressSpace: "loopback" }).catch(() => null)
    setBusy(false)
    if (!response?.ok) return setMessage("Could not revoke the local pairing.")
    sessionStorage.removeItem("codetutor.local-pairing")
    setLocalPairing()
    setMessage("Local pairing revoked.")
  }

  return (
    <main class="min-h-screen bg-background-base text-text-strong flex items-start justify-center overflow-y-auto p-6">
      <section class="my-auto w-full max-w-2xl border border-border-weak-base rounded-lg bg-surface-base p-6">
        <p class="text-12-medium uppercase tracking-wider text-text-weak">{language.t("account.title")}</p>
        <h1 class="mt-3 text-20-medium">{language.t("account.signedIn")}</h1>
        <p class="mt-2 text-14-regular text-text-base">{props.session.user.email}</p>
        <dl class="mt-6 grid grid-cols-[1fr_auto] gap-2 text-12-regular">
          <dt class="text-text-base">{language.t("account.plan")}</dt><dd>{entitlement()?.allowance.name ?? language.t("common.loading")}</dd>
          <dt class="text-text-base">{language.t("account.models")}</dt><dd>{language.t("account.models.all")}</dd>
          <dt class="text-text-base">{language.t("account.managedAi")}</dt><dd>{language.t("account.managedOnly")}</dd>
          <dt class="text-text-base">{language.t("account.status")}</dt><dd>{entitlement()?.managed_ai ? language.t("account.available") : language.t("account.unavailable")}</dd>
        </dl>
        <Show when={entitlement()} keyed>
          {(current) => (
            <div class="mt-6 border-t border-border-weak-base pt-5">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-12-medium uppercase tracking-wider text-text-weak">{language.t("account.currentPlan")}</p>
                  <p class="mt-1 text-16-medium">{current.allowance.name}</p>
                  <p class="mt-1 text-12-regular text-text-base">{current.period.start} – {current.period.end}</p>
                </div>
                <Show when={current.plan !== "free"}>
                  <button
                    type="button"
                    disabled={busy()}
                    onClick={() => void billing("/api/billing/portal")}
                    class="h-9 px-3 rounded-md border border-border-base text-12-medium disabled:opacity-50"
                  >
                    {language.t("account.manageBilling")}
                  </button>
                </Show>
              </div>
              <Show when={usage()} keyed>
                {(month) => (
                  <dl class="mt-4 grid grid-cols-[1fr_auto] gap-2 text-12-regular">
                    <dt class="text-text-base">{language.t("account.requestsRemaining")}</dt><dd>{month.remaining.requests.toLocaleString()}</dd>
                    <dt class="text-text-base">{language.t("account.tokensRemaining")}</dt><dd>{month.remaining.tokens.toLocaleString()}</dd>
                    <dt class="text-text-base">{language.t("account.creditRemaining")}</dt><dd>${month.remaining.spend_usd.toFixed(2)}</dd>
                    <dt class="text-text-base">{language.t("account.topupBalance")}</dt><dd>${(month.credit.remainingNanos / 1_000_000_000).toFixed(2)}</dd>
                  </dl>
                )}
              </Show>
              <div class="mt-5 grid gap-3 sm:grid-cols-2">
                <Show when={current.plan !== "starter"}>
                  <button
                    type="button"
                    disabled={busy() || !current.billing}
                    onClick={() => void billing("/api/billing/change-plan", { plan: "starter" })}
                    class="rounded-md border border-border-base p-4 text-left hover:bg-surface-raised-base-hover disabled:opacity-50"
                  >
                    <span class="block text-14-medium">{language.t("account.starter.title")}</span>
                    <span class="mt-1 block text-12-regular text-text-base">{language.t("account.starter.description")}</span>
                  </button>
                </Show>
                <Show when={current.plan !== "pro"}>
                  <button
                    type="button"
                    disabled={busy() || !current.billing}
                    onClick={() => void billing("/api/billing/change-plan", { plan: "pro" })}
                    class="rounded-md border border-border-base p-4 text-left hover:bg-surface-raised-base-hover disabled:opacity-50"
                  >
                    <span class="block text-14-medium">{language.t("account.pro.title")}</span>
                    <span class="mt-1 block text-12-regular text-text-base">{language.t("account.pro.description")}</span>
                  </button>
                </Show>
              </div>
              <Show when={current.topups && current.plan !== "free"}>
                <div class="mt-6">
                  <p class="text-12-medium uppercase tracking-wider text-text-weak">{language.t("account.buyCredit")}</p>
                  <div class="mt-3 grid grid-cols-3 gap-2">
                    <For each={[{ pack: "5", price: "7" }, { pack: "10", price: "13" }, { pack: "25", price: "32" }] as const}>
                      {(item) => (
                        <button
                          type="button"
                          disabled={busy()}
                          onClick={() => void billing("/api/billing/topup", { pack: item.pack })}
                          class="rounded-md border border-border-base p-3 text-left hover:bg-surface-raised-base-hover disabled:opacity-50"
                        >
                          <span class="block text-13-medium">${item.pack} {language.t("account.credit")}</span>
                          <span class="mt-1 block text-12-regular text-text-base">${item.price}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>
          )}
        </Show>
        <Show when={profile()} keyed>
          {(current) => (
            <div class="mt-6 border-t border-border-weak-base pt-5">
              <p class="text-12-medium uppercase tracking-wider text-text-weak">{language.t("account.profile")}</p>
              <label class="mt-3 flex items-center justify-between gap-4 text-12-regular">
                <span class="text-text-base">{language.t("account.learnerLevel")}</span>
                <select
                  value={current.learner_level}
                  disabled={busy()}
                  onChange={(event) => void updateLevel(event.currentTarget.value as typeof current.learner_level)}
                  class="h-9 rounded-md border border-border-base bg-background-base px-3 outline-none focus:border-border-selected"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
            </div>
          )}
        </Show>
        <div class="mt-6 border-t border-border-weak-base pt-5">
          <p class="text-12-medium uppercase tracking-wider text-text-weak">{language.t("account.sessions")}</p>
          <div class="mt-3 space-y-2">
            <For each={sessions()?.sessions.filter((item) => !item.revoked_at) ?? []}>
              {(item) => (
                <div class="flex items-center justify-between gap-3 rounded-md border border-border-weak-base p-3 text-12-regular">
                  <div class="min-w-0">
                    <p class="truncate text-text-strong">
                      {item.device_name ?? item.client_type}
                      <Show when={item.id === sessions()?.current_session_id}> · {language.t("account.session.current")}</Show>
                    </p>
                    <p class="mt-1 truncate text-text-weak">{item.platform ?? item.client_type} · {item.last_seen_at}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy()}
                    onClick={() => void revokeSession(item.id)}
                    class="h-8 shrink-0 rounded-md border border-border-base px-3 disabled:opacity-50"
                  >
                    {language.t("account.session.revoke")}
                  </button>
                </div>
              )}
            </For>
            <Show when={(sessions()?.sessions.filter((item) => !item.revoked_at).length ?? 0) === 0}>
              <p class="text-12-regular text-text-weak">{language.t("account.session.none")}</p>
            </Show>
          </div>
        </div>
        <div class="mt-6 border-t border-border-weak-base pt-5">
          <p class="text-12-medium uppercase tracking-wider text-text-weak">Local repository access</p>
          <p class="mt-2 text-12-regular text-text-base">
            The hosted app can reach repositories only through a loopback CodeTutor server you approve. Pairings expire after 30 days and are revocable with <code>codetutor pairing</code>.
          </p>
          <div class="mt-3 flex gap-2">
            <input
              value={pairingUrl()}
              onInput={(event) => setPairingUrl(event.currentTarget.value)}
              class="h-9 min-w-0 flex-1 rounded-md border border-border-base bg-background-base px-3 font-mono text-12-regular outline-none focus:border-border-selected"
            />
            <button
              type="button"
              disabled={busy()}
              onClick={() => void pairLocalServer()}
              class="h-9 rounded-md border border-border-base px-3 text-12-medium disabled:opacity-50"
            >
              Pair server
            </button>
          </div>
          <Show when={pairingCode()}>
            <div class="mt-3 rounded-md border border-border-selected bg-background-base p-3">
              <p class="text-12-regular">Approve this exact code in another terminal:</p>
              <code class="mt-2 block text-14-medium">codetutor pairing approve {pairingCode()}</code>
            </div>
          </Show>
          <Show when={localPairing()} keyed>
            {(pairing) => (
              <div class="mt-3 flex items-center justify-between gap-3 rounded-md border border-border-weak-base p-3 text-12-regular">
                <div class="min-w-0">
                  <p class="truncate text-text-strong">{pairing.email}</p>
                  <p class="mt-1 truncate text-text-weak">Expires {pairing.expires_at}</p>
                </div>
                <button
                  type="button"
                  disabled={busy()}
                  onClick={() => void revokePairing()}
                  class="h-8 shrink-0 rounded-md border border-border-base px-3 disabled:opacity-50"
                >
                  Revoke pairing
                </button>
              </div>
            )}
          </Show>
        </div>
        <div class="mt-6 border-t border-border-weak-base pt-5">
          <p class="text-12-medium uppercase tracking-wider text-text-weak">Security</p>
          <p class="mt-2 text-12-regular text-text-base">
            Authenticator MFA protects billing changes, service keys, credential rotation, and deletion.
          </p>
          <Show
            when={totpFactor() || totpEnrollment()}
            fallback={
              <button
                type="button"
                disabled={busy()}
                onClick={() => void enrollTotp()}
                class="mt-3 h-9 rounded-md border border-border-base px-3 text-12-medium disabled:opacity-50"
              >
                Set up authenticator MFA
              </button>
            }
          >
            <Show when={totpEnrollment()} keyed>
              {(enrollment) => (
                <div class="mt-3 rounded-md border border-border-weak-base p-3">
                  <img src={enrollment.qr} alt="Authenticator QR code" class="size-40 bg-white p-2" />
                  <p class="mt-2 break-all font-mono text-12-regular">{enrollment.secret}</p>
                </div>
              )}
            </Show>
            <div class="mt-3 flex gap-2">
              <input
                inputmode="numeric"
                maxlength={6}
                value={totpCode()}
                onInput={(event) => setTotpCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                class="h-9 min-w-0 flex-1 rounded-md border border-border-base bg-background-base px-3 font-mono text-12-regular outline-none focus:border-border-selected"
              />
              <button
                type="button"
                disabled={busy() || totpCode().length !== 6}
                onClick={() => void verifyTotp()}
                class="h-9 rounded-md border border-border-base px-3 text-12-medium disabled:opacity-50"
              >
                Verify MFA
              </button>
            </div>
            <p class="mt-2 text-12-regular text-text-weak">Session assurance: {assuranceLevel() ?? "aal1"}</p>
            <Show when={assuranceLevel() === "aal2"}>
              <button
                type="button"
                disabled={busy()}
                onClick={() => void generateRecoveryCodes()}
                class="mt-3 h-9 rounded-md border border-border-base px-3 text-12-medium disabled:opacity-50"
              >
                Generate new recovery codes
              </button>
            </Show>
            <Show when={recoveryCodes().length > 0}>
              <div class="mt-3 rounded-md border border-border-selected bg-background-base p-3">
                <p class="text-12-medium">Store these codes securely. Each code works once.</p>
                <code class="mt-2 block whitespace-pre-wrap text-12-regular">{recoveryCodes().join("\n")}</code>
              </div>
            </Show>
            <Show when={totpFactor() && assuranceLevel() !== "aal2"}>
              <div class="mt-4">
                <p class="text-12-regular text-text-base">Lost your authenticator? Use one recovery code.</p>
                <div class="mt-2 flex gap-2">
                  <input
                    value={recoveryCode()}
                    onInput={(event) => setRecoveryCode(event.currentTarget.value.toUpperCase())}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    class="h-9 min-w-0 flex-1 rounded-md border border-border-base bg-background-base px-3 font-mono text-12-regular outline-none focus:border-border-selected"
                  />
                  <button
                    type="button"
                    disabled={busy() || !recoveryCode().trim()}
                    onClick={() => void recoverMfa()}
                    class="h-9 rounded-md border border-border-base px-3 text-12-medium disabled:opacity-50"
                  >
                    Recover
                  </button>
                </div>
              </div>
            </Show>
          </Show>
        </div>
        <div class="mt-6 border-t border-border-weak-base pt-5">
          <p class="text-12-medium uppercase tracking-wider text-text-weak">Scoped service keys</p>
          <p class="mt-2 text-12-regular text-text-base">
            Keys can call managed AI only. They expire within 90 days and cannot change billing or your profile.
          </p>
          <div class="mt-3 flex gap-2">
            <input
              value={serviceKeyName()}
              onInput={(event) => setServiceKeyName(event.currentTarget.value)}
              placeholder="Key name"
              class="h-9 min-w-0 flex-1 rounded-md border border-border-base bg-background-base px-3 text-12-regular outline-none focus:border-border-selected"
            />
            <button
              type="button"
              disabled={busy() || !serviceKeyName().trim()}
              onClick={() => void createServiceKey()}
              class="h-9 rounded-md border border-border-base px-3 text-12-medium disabled:opacity-50"
            >
              Create 30-day key
            </button>
          </div>
          <Show when={serviceKeySecret()}>
            <div class="mt-3 rounded-md border border-border-selected bg-background-base p-3">
              <p class="text-12-medium">Copy this secret now. It will not be shown again.</p>
              <code class="mt-2 block break-all text-12-regular">{serviceKeySecret()}</code>
            </div>
          </Show>
          <div class="mt-3 space-y-2">
            <For each={serviceKeys().filter((item) => !item.revoked_at)}>
              {(item) => (
                <div class="flex items-center justify-between gap-3 rounded-md border border-border-weak-base p-3 text-12-regular">
                  <div class="min-w-0">
                    <p class="truncate text-text-strong">{item.name} · {item.token_prefix}…</p>
                    <p class="mt-1 truncate text-text-weak">Expires {item.expires_at}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy()}
                    onClick={() => void revokeServiceKey(item.id)}
                    class="h-8 shrink-0 rounded-md border border-border-base px-3 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
        <div class="mt-6 border-t border-border-weak-base pt-5">
          <p class="text-12-medium uppercase tracking-wider text-text-weak">Privacy and account</p>
          <button
            type="button"
            disabled={busy()}
            onClick={() => void exportAccount()}
            class="mt-3 h-9 rounded-md border border-border-base px-3 text-12-medium disabled:opacity-50"
          >
            Export my data
          </button>
          <div class="mt-4 rounded-md border border-border-weak-base p-3">
            <p class="text-12-medium">Delete account</p>
            <p class="mt-1 text-12-regular text-text-base">Type DELETE to schedule deletion with a seven-day recovery window.</p>
            <div class="mt-3 flex gap-2">
              <input
                value={deleteConfirmation()}
                onInput={(event) => setDeleteConfirmation(event.currentTarget.value)}
                class="h-9 min-w-0 flex-1 rounded-md border border-border-base bg-background-base px-3 text-12-regular outline-none focus:border-border-selected"
              />
              <button
                type="button"
                disabled={busy() || deleteConfirmation() !== "DELETE"}
                onClick={() => void deleteAccount()}
                class="h-9 rounded-md border border-icon-critical-base px-3 text-12-medium text-icon-critical-base disabled:opacity-50"
              >
                Schedule deletion
              </button>
            </div>
          </div>
        </div>
        <Show when={message()}>
          <p role="status" class="mt-4 text-12-regular text-text-base">{message()}</p>
        </Show>
        <button
          type="button"
          disabled={busy()}
          onClick={() => void signOut()}
          class="mt-6 h-10 w-full rounded-md border border-border-base text-14-medium hover:bg-surface-raised-base-hover disabled:opacity-50"
        >
          {language.t("account.signOut")}
        </button>
      </section>
    </main>
  )
}

export const callbackCode = (value: string) => {
  if (!URL.canParse(value)) return null
  const url = new URL(value)
  if (url.protocol !== "codetutor:" || url.hostname !== "auth" || url.pathname !== "/callback") return null
  return url.searchParams.get("code")
}

export function AccountGate(props: ParentProps) {
  if (!enabled()) return props.children
  const [local, setLocal] = createSignal(false)
  const platform = usePlatform()
  const supabase = client(platform.platform === "desktop" ? platform.secureStorage : undefined)
  if (!supabase)
    return (
      <Show when={!local()} fallback={props.children}>
        <AccountSetupRequired onLocal={() => setLocal(true)} />
      </Show>
    )

  const [session, setSession] = createSignal<Session | null>(null)
  const [offline, setOffline] = createSignal(false)
  const [ready, setReady] = createSignal(false)

  const acceptCallback = async (value: string) => {
    const code = callbackCode(value)
    if (!code) return
    await supabase.auth.exchangeCodeForSession(code)
  }

  onMount(() => {
    const current = new URL(location.href)
    const code = current.searchParams.get("code")
    const initial = code ? supabase.auth.exchangeCodeForSession(code) : supabase.auth.getSession()
    void initial.then((result) => {
      setSession(result.data.session)
      setOffline(!result.data.session && navigator.onLine === false && localStorage.getItem(verifiedKey) === "1")
      setReady(true)
    })

    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ urls?: string[] }>).detail
      for (const value of detail?.urls ?? []) void acceptCallback(value)
    }
    window.addEventListener("codetutor:deep-link", listener)
    const subscription = supabase.auth.onAuthStateChange((event: AuthChangeEvent, next) => {
      setSession(next)
      if (next) {
        localStorage.setItem(verifiedKey, "1")
        setOffline(false)
        return
      }
      if (event === "SIGNED_OUT" && navigator.onLine) localStorage.removeItem(verifiedKey)
    })
    onCleanup(() => {
      window.removeEventListener("codetutor:deep-link", listener)
      subscription.data.subscription.unsubscribe()
    })
  })

  createEffect(() => {
    if (!session()) return
    if (location.pathname !== "/auth/callback") return
    history.replaceState(null, "", "/")
  })

  return (
    <Show when={!local()} fallback={props.children}>
      <Show when={ready()} fallback={<main class="min-h-screen bg-background-base" />}>
        <Show
          when={session()}
          fallback={
            <Show when={offline()} fallback={<SignIn supabase={supabase} onLocal={() => setLocal(true)} />}>
              {props.children}
            </Show>
          }
          keyed
        >
          {(active) => (
            <Show
              when={location.pathname === "/device"}
              fallback={
                <Show when={location.pathname === "/account"} fallback={props.children}>
                  <AccountHome supabase={supabase} session={active} />
                </Show>
              }
            >
              <DeviceApproval session={active} />
            </Show>
          )}
        </Show>
      </Show>
    </Show>
  )
}
