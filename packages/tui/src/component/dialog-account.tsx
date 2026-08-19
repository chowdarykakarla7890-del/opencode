import { TextAttributes } from "@opentui/core"
import { createSignal, onMount, Show } from "solid-js"
import type { TuiAccountAdapter, TuiAccountSummary } from "../account"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { StudioSectionLabel, StudioStatusChip } from "../ui/studio"

export function DialogAccount(props: { account: TuiAccountAdapter }) {
  const { theme } = useTheme()
  const dialog = useDialog()
  const [summary, setSummary] = createSignal<TuiAccountSummary>()
  const [error, setError] = createSignal<string>()

  onMount(() => {
    void props.account
      .summary()
      .then(setSummary)
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
  })

  const open = (action: "account" | "upgrade" | "topup" | "billing") => {
    void props.account.open(action)
  }

  return (
    <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1} minWidth={54}>
      <box flexDirection="row" justifyContent="space-between">
        <StudioSectionLabel label="Account and usage" />
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <Show when={error()}>{(message) => <text fg={theme.error}>{message()}</text>}</Show>
      <Show when={summary()} fallback={<text fg={theme.textMuted}>Loading account…</text>}>
        {(value) => (
          <Show
            when={value().authenticated}
            fallback={
              <box gap={1}>
                <text fg={theme.text}>Sign in to use managed AI.</text>
                <text fg={theme.textMuted}>Local lessons and deterministic checks remain available.</text>
                <text fg={theme.warning} onMouseUp={() => open("account")}>
                  Open sign in
                </text>
                <text fg={theme.textMuted}>Or exit and run: codetutor account login</text>
              </box>
            }
          >
            <box gap={1}>
              <box flexDirection="row" justifyContent="space-between">
                <text fg={theme.text} attributes={TextAttributes.BOLD}>
                  {value().email}
                </text>
                <StudioStatusChip label={value().plan ?? "Free"} />
              </box>
              <text fg={theme.textMuted}>
                Level: {value().learnerLevel ?? "beginner"} · Active sessions: {value().sessions ?? 0}
              </text>
              <box borderStyle="single" borderColor={theme.border} paddingLeft={1} paddingRight={1}>
                <text fg={theme.text}>
                  Requests {format(value().requestsUsed)} used · {format(value().requestsRemaining)} remaining
                  {"\n"}Tokens {format(value().tokensUsed)} used · {format(value().tokensRemaining)} remaining
                  {"\n"}Included credit ${money(value().includedCreditUsed)} used · $
                  {money(value().includedCreditRemaining)} remaining
                  {"\n"}Top-up credit ${money(value().topupCredit)}
                </text>
              </box>
              <Show when={value().periodEnd}>
                <text fg={theme.textMuted}>Renews or resets {new Date(value().periodEnd!).toLocaleDateString()}</text>
              </Show>
              <box flexDirection="row" gap={2}>
                <text fg={theme.warning} onMouseUp={() => open("upgrade")}>
                  upgrade
                </text>
                <text fg={theme.warning} onMouseUp={() => open("topup")}>
                  top up
                </text>
                <text fg={theme.warning} onMouseUp={() => open("billing")}>
                  billing
                </text>
                <text fg={theme.textMuted} onMouseUp={() => open("account")}>
                  profile and sessions
                </text>
              </box>
            </box>
          </Show>
        )}
      </Show>
    </box>
  )
}

function format(value?: number) {
  return (value ?? 0).toLocaleString()
}

function money(value?: number) {
  return (value ?? 0).toFixed(2)
}
