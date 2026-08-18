/** @jsxImportSource @opentui/solid */
import { afterEach, describe, expect, test } from "bun:test"
import { TextAttributes } from "@opentui/core"
import { testRender, useTerminalDimensions } from "@opentui/solid"
import { Show, type ParentProps } from "solid-js"
import { DEFAULT_THEMES, resolveTheme } from "../src/theme"
import { studioBorder } from "../src/ui/studio"

let active: Awaited<ReturnType<typeof testRender>> | undefined
const theme = resolveTheme(DEFAULT_THEMES.codetutor, "dark")

afterEach(() => {
  active?.renderer.destroy()
  active = undefined
})

function Surface(props: ParentProps<{ title: string; tone?: "neutral" | "active" | "warning" | "error" }>) {
  const color = () => {
    if (props.tone === "active") return theme.primary
    if (props.tone === "warning") return theme.warning
    if (props.tone === "error") return theme.error
    return theme.border
  }
  return (
    <box
      border={["top", "bottom", "left", "right"]}
      borderColor={color()}
      customBorderChars={studioBorder}
      backgroundColor={theme.backgroundPanel}
      paddingLeft={1}
      paddingRight={1}
      flexGrow={1}
    >
      <SectionLabel label={props.title} />
      {props.children}
    </box>
  )
}

function SectionLabel(props: { label: string }) {
  return (
    <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>
      {props.label.toUpperCase()}
    </text>
  )
}

function StatusChip(props: { label: string; tone: "success" | "error" }) {
  return <text fg={theme[props.tone]}>[{props.label.toUpperCase()}]</text>
}

function KeyHint(props: { keyLabel: string; label: string }) {
  return (
    <text>
      <span style={{ fg: theme.text }}>{props.keyLabel}</span>
      <span style={{ fg: theme.textMuted }}> {props.label}</span>
    </text>
  )
}

function StudioGallery() {
  const dimensions = useTerminalDimensions()
  const wide = () => dimensions().width >= 110
  return (
    <box backgroundColor={theme.background} paddingLeft={1} paddingRight={1} gap={wide() ? 1 : 0}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text}>CODETUTOR // TERMINAL STUDIO</text>
        <StatusChip label="local" tone="success" />
      </box>

      <Show when={!wide()}>
        <Surface title="CodeTutor // compact terminal" tone="active">
          <text fg={theme.text}>Ask anything... “Teach me by building”</text>
          <text fg={theme.textMuted}>PLAN · GPT-5.6 TERRA FAST</text>
          <text fg={theme.primary}>YOU · Help me understand this function.</text>
          <text fg={theme.text}>TUTOR · What does its return value tell you?</text>
          <text fg={theme.textMuted}>TOOL · READ src/index.ts</text>
          <text fg={theme.text}>SIDEBAR · Lesson 04 · Functions [OPEN]</text>
          <text fg={theme.primary}>PALETTE · /lesson · /hint · /check</text>
          <text fg={theme.warning}>PERMISSION · Allow edit to src/index.ts?</text>
          <KeyHint keyLabel="enter" label="allow   esc reject" />
          <text fg={theme.primary}>QUESTION · Add a focused test</text>
          <text fg={theme.error}>NOTIFICATION · CHECK FAILED · retry</text>
        </Surface>
      </Show>

      <Show when={wide()}>
        <box flexDirection="row" gap={1}>
          <Surface title="Home // tutor prompt" tone="active">
            <text fg={theme.text}>CODETUTOR</text>
            <text fg={theme.textMuted}>Ask anything... “Teach me by building”</text>
            <box
              border={["left"]}
              borderColor={theme.primary}
              backgroundColor={theme.backgroundElement}
              paddingLeft={1}
            >
              <text fg={theme.text}>Plan · GPT-5.6 Terra Fast</text>
            </box>
            <KeyHint keyLabel="tab" label="agents   ctrl+p commands" />
          </Surface>

          <Show when={wide()}>
            <Surface title="Session transcript">
              <text fg={theme.primary}>YOU</text>
              <text fg={theme.text}>Help me understand this function.</text>
              <text fg={theme.textMuted}>TUTOR // BEGINNER</text>
              <text fg={theme.text}>What do you notice about its return value?</text>
              <box border={["left"]} borderColor={theme.borderSubtle} paddingLeft={1}>
                <text fg={theme.textMuted}>TOOL // READ src/index.ts</text>
              </box>
            </Surface>
          </Show>
        </box>

        <box flexDirection="row" gap={1}>
          <Surface title="Sidebar // runtime">
            <text fg={theme.text}>Lesson 04 · Functions</text>
            <Show when={wide()}>
              <text fg={theme.textMuted}>Workspace ~/code/lesson-04</text>
            </Show>
            <StatusChip label="open" tone="success" />
          </Surface>
          <Surface title="Command palette" tone="active">
            <text fg={theme.primary}>› /lesson Open lesson catalog</text>
            <Show when={wide()}>
              <text fg={theme.textMuted}> /hint Reveal the next hint</text>
            </Show>
          </Surface>
        </box>

        <Show
          when={wide()}
          fallback={
            <Surface title="Tool // permission // question // notification" tone="warning">
              <text fg={theme.textMuted}>READ src/index.ts · Allow edit?</text>
              <KeyHint keyLabel="enter" label="allow   esc reject" />
              <text fg={theme.primary}>› Add a focused test</text>
              <text fg={theme.error}>CHECK FAILED · retry</text>
            </Surface>
          }
        >
          <box flexDirection="row" gap={1}>
            <Surface title="Permission request" tone="warning">
              <text fg={theme.warning}>Allow edit to src/index.ts?</text>
              <KeyHint keyLabel="enter" label="allow   esc reject" />
            </Surface>
            <Surface title="Tutor question" tone="active">
              <text fg={theme.text}>Which approach would you try first?</text>
              <text fg={theme.primary}>› Add a focused test</text>
            </Surface>
            <Surface title="Notification" tone="error">
              <text fg={theme.error}>CHECK FAILED</text>
              <text fg={theme.textMuted}>Review the validator output and retry.</text>
            </Surface>
          </box>
        </Show>
      </Show>
    </box>
  )
}

async function frame(width: number, height: number) {
  active = await testRender(() => <StudioGallery />, { width, height })
  await active.renderOnce()
  await active.renderOnce()
  return active
    .captureCharFrame()
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd()
}

describe("CodeTutor Studio visual contract", () => {
  test("80x24", async () => {
    expect(await frame(80, 24)).toMatchSnapshot()
  })

  test("120x36", async () => {
    expect(await frame(120, 36)).toMatchSnapshot()
  })

  test("160x48", async () => {
    expect(await frame(160, 48)).toMatchSnapshot()
  })
})
