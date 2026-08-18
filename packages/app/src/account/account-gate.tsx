import { createClient, type AuthChangeEvent, type Session, type SupabaseClient } from "@supabase/supabase-js"
import { createEffect, createSignal, onCleanup, onMount, Show, type ParentProps } from "solid-js"
import { usePlatform } from "@/context/platform"

const accountUrl = () => import.meta.env.VITE_CODETUTOR_ACCOUNT_URL?.trim() || "https://codetutor-cloud.vercel.app"
const enabled = () => import.meta.env.VITE_CODETUTOR_ACCOUNT_ENABLED === "1"
const verifiedKey = "codetutor.account.dat:verified"

const client = () => {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { detectSessionInUrl: false, flowType: "pkce", persistSession: true, autoRefreshToken: true },
  })
}

const authCallback = (desktop: boolean) => {
  if (desktop) return "codetutor://auth/callback"
  if (location.pathname === "/device") return location.href
  return `${location.origin}/auth/callback`
}

function AccountSetupRequired() {
  return (
    <main class="min-h-screen bg-background-base text-text-strong flex items-center justify-center p-6">
      <section class="w-full max-w-md border border-border-weak-base rounded-lg bg-surface-base p-6">
        <p class="text-12-medium uppercase tracking-wider text-text-weak">CodeTutor account</p>
        <h1 class="mt-3 text-20-medium">Account service setup required</h1>
        <p class="mt-2 text-14-regular text-text-base">
          Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, or disable the account rollout flag.
        </p>
      </section>
    </main>
  )
}

function SignIn(props: { supabase: SupabaseClient }) {
  const platform = usePlatform()
  const [email, setEmail] = createSignal("")
  const [message, setMessage] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const desktop = platform.platform === "desktop"

  const magicLink = async (event: SubmitEvent) => {
    event.preventDefault()
    setBusy(true)
    const result = await props.supabase.auth.signInWithOtp({
      email: email().trim(),
      options: { emailRedirectTo: authCallback(desktop) },
    })
    setBusy(false)
    setMessage(result.error?.message ?? "Check your email for the CodeTutor sign-in link.")
  }

  const oauth = async (provider: "github" | "google") => {
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
            <h1 class="text-20-medium">Sign in to keep learning</h1>
          </div>
        </div>
        <p class="mt-4 text-14-regular text-text-base">
          Your lessons and BYOK models remain local. Sign in to manage a plan and optional CodeTutor managed AI.
        </p>
        <button
          type="button"
          disabled={busy()}
          onClick={() => void oauth("github")}
          class="mt-6 h-10 w-full rounded-md bg-surface-brand-base text-text-on-brand-strong text-14-medium disabled:opacity-50"
        >
          Continue with GitHub
        </button>
        <div class="my-4 flex items-center gap-3 text-12-regular text-text-weak">
          <span class="h-px flex-1 bg-border-weak-base" /> or use email <span class="h-px flex-1 bg-border-weak-base" />
        </div>
        <form class="mt-6 flex flex-col gap-3" onSubmit={magicLink}>
          <label class="text-12-medium text-text-base" for="codetutor-account-email">Email</label>
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
            disabled={busy() || !email().trim()}
            class="h-10 rounded-md bg-surface-brand-base text-text-on-brand-strong text-14-medium disabled:opacity-50"
          >
            Email me a sign-in link
          </button>
        </form>
        <Show when={message()}>
          <p role="status" class="mt-4 text-12-regular text-text-base">{message()}</p>
        </Show>
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
  const [busy, setBusy] = createSignal(false)
  const [message, setMessage] = createSignal("")
  const [entitlement, setEntitlement] = createSignal<{
    plan: string
    billing: boolean
    managed_ai: boolean
    subscription: { current_period_end?: string; cancel_at_period_end?: boolean } | null
    allowance: {
      name: string
      price_monthly: number
      limits: { requests_monthly: number; tokens_monthly: number; spend_monthly_usd: number }
    }
  } | null>(null)
  const [usage, setUsage] = createSignal<{
    usage: { request_count: number; input_tokens: number; output_tokens: number; spend_usd: number }
    remaining: { requests: number; tokens: number; spend_usd: number }
  } | null>(null)

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
    const [nextEntitlement, nextUsage] = await Promise.all([
      accountFetch("/api/entitlements"),
      accountFetch("/api/usage"),
    ]).catch(() => [])
    if (nextEntitlement?.ok) setEntitlement(await nextEntitlement.json())
    if (nextUsage?.ok) setUsage(await nextUsage.json())
  }

  onMount(() => void refresh())

  const billing = async (path: string, plan?: "starter" | "pro") => {
    setBusy(true)
    setMessage("")
    const response = await accountFetch(path, { method: "POST", body: plan ? JSON.stringify({ plan }) : undefined }).catch(
      () => null,
    )
    setBusy(false)
    if (!response) return setMessage("Could not reach CodeTutor billing.")
    const result: { url?: string; error?: string } = await response.json().catch(() => ({}))
    if (!response.ok || !result.url) return setMessage(result.error ?? "Billing is not available yet.")
    location.assign(result.url)
  }

  const signOut = async () => {
    setBusy(true)
    await props.supabase.auth.signOut()
    localStorage.removeItem(verifiedKey)
    setBusy(false)
  }

  return (
    <main class="min-h-screen bg-background-base text-text-strong flex items-center justify-center p-6">
      <section class="w-full max-w-2xl border border-border-weak-base rounded-lg bg-surface-base p-6">
        <p class="text-12-medium uppercase tracking-wider text-text-weak">CodeTutor account</p>
        <h1 class="mt-3 text-20-medium">Signed in</h1>
        <p class="mt-2 text-14-regular text-text-base">{props.session.user.email}</p>
        <dl class="mt-6 grid grid-cols-[1fr_auto] gap-2 text-12-regular">
          <dt class="text-text-base">Plan</dt><dd>{entitlement()?.allowance.name ?? "Loading…"}</dd>
          <dt class="text-text-base">Bundled lessons</dt><dd>Available</dd>
          <dt class="text-text-base">BYOK models</dt><dd>Available</dd>
          <dt class="text-text-base">Cloud sync</dt><dd>Not enabled</dd>
          <dt class="text-text-base">Managed AI</dt><dd>{entitlement()?.managed_ai ? "Available" : "Plan required"}</dd>
        </dl>
        <Show when={entitlement()} keyed>
          {(current) => (
            <div class="mt-6 border-t border-border-weak-base pt-5">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-12-medium uppercase tracking-wider text-text-weak">Current plan</p>
                  <p class="mt-1 text-16-medium">{current.allowance.name}</p>
                </div>
                <Show when={current.plan !== "free"}>
                  <button
                    type="button"
                    disabled={busy()}
                    onClick={() => void billing("/api/billing/portal")}
                    class="h-9 px-3 rounded-md border border-border-base text-12-medium disabled:opacity-50"
                  >
                    Manage billing
                  </button>
                </Show>
              </div>
              <Show when={usage()} keyed>
                {(month) => (
                  <dl class="mt-4 grid grid-cols-[1fr_auto] gap-2 text-12-regular">
                    <dt class="text-text-base">Requests remaining</dt><dd>{month.remaining.requests.toLocaleString()}</dd>
                    <dt class="text-text-base">Tokens remaining</dt><dd>{month.remaining.tokens.toLocaleString()}</dd>
                    <dt class="text-text-base">AI spend remaining</dt><dd>${month.remaining.spend_usd.toFixed(2)}</dd>
                  </dl>
                )}
              </Show>
              <Show when={current.plan === "free"}>
                <div class="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={busy() || !current.billing}
                    onClick={() => void billing("/api/billing/checkout", "starter")}
                    class="rounded-md border border-border-base p-4 text-left hover:bg-surface-raised-base-hover disabled:opacity-50"
                  >
                    <span class="block text-14-medium">Starter · $12/month</span>
                    <span class="mt-1 block text-12-regular text-text-base">1,000 requests · 2M tokens · $5 AI spend</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy() || !current.billing}
                    onClick={() => void billing("/api/billing/checkout", "pro")}
                    class="rounded-md border border-border-base p-4 text-left hover:bg-surface-raised-base-hover disabled:opacity-50"
                  >
                    <span class="block text-14-medium">Pro · $29/month</span>
                    <span class="mt-1 block text-12-regular text-text-base">4,000 requests · 8M tokens · $15 AI spend</span>
                  </button>
                </div>
              </Show>
            </div>
          )}
        </Show>
        <Show when={message()}>
          <p role="status" class="mt-4 text-12-regular text-text-base">{message()}</p>
        </Show>
        <button
          type="button"
          disabled={busy()}
          onClick={() => void signOut()}
          class="mt-6 h-10 w-full rounded-md border border-border-base text-14-medium hover:bg-surface-raised-base-hover disabled:opacity-50"
        >
          Sign out
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
  const supabase = client()
  if (!supabase) return <AccountSetupRequired />

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
    <Show when={ready()} fallback={<main class="min-h-screen bg-background-base" />}>
      <Show
        when={session()}
        fallback={
          <Show when={offline()} fallback={<SignIn supabase={supabase} />}>
            {props.children}
          </Show>
        }
        keyed
      >
        {(active) => (
          <Show
            when={location.pathname === "/device"}
            fallback={
              <Show
                when={location.pathname === "/account"}
                fallback={props.children}
              >
                <AccountHome supabase={supabase} session={active} />
              </Show>
            }
          >
            <DeviceApproval session={active} />
          </Show>
        )}
      </Show>
    </Show>
  )
}
