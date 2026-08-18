import { RGBA, TextAttributes } from "@opentui/core"
import { Show, type JSX } from "solid-js"
import { useTheme } from "../context/theme"

export const studioBorder = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
  topT: "┬",
  bottomT: "┴",
  leftT: "├",
  rightT: "┤",
  cross: "┼",
}

export function isStudioTheme(selected: string) {
  return selected === "codetutor"
}

export function useStudioPresentation() {
  const state = useTheme()
  return {
    enabled: () => isStudioTheme(state.selected),
    panel: () => (isStudioTheme(state.selected) ? state.theme.backgroundPanel : undefined),
    element: () => (isStudioTheme(state.selected) ? state.theme.backgroundElement : undefined),
    border: () => (isStudioTheme(state.selected) ? state.theme.border : undefined),
    active: () => (isStudioTheme(state.selected) ? state.theme.primary : undefined),
    selected: () =>
      isStudioTheme(state.selected)
        ? RGBA.fromValues(
            state.theme.primary.r,
            state.theme.primary.g,
            state.theme.primary.b,
            state.theme.background.a === 0 ? 0.16 : 0.12,
          )
        : undefined,
  }
}

export function StudioSectionLabel(props: { label: string; right?: JSX.Element }) {
  const state = useTheme()
  const studio = useStudioPresentation()
  return (
    <Show when={studio.enabled()}>
      <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
        <text fg={state.theme.textMuted} attributes={TextAttributes.BOLD}>
          {props.label.toUpperCase()}
        </text>
        {props.right}
      </box>
    </Show>
  )
}

export function StudioStatusChip(props: {
  label: string
  tone?: "muted" | "active" | "success" | "warning" | "error"
}) {
  const state = useTheme()
  const color = () => {
    if (props.tone === "active") return state.theme.primary
    if (props.tone === "success") return state.theme.success
    if (props.tone === "warning") return state.theme.warning
    if (props.tone === "error") return state.theme.error
    return state.theme.textMuted
  }
  return (
    <text fg={color()}>
      [
      <span style={{ fg: props.tone === "muted" || !props.tone ? state.theme.textMuted : state.theme.text }}>
        {props.label.toUpperCase()}
      </span>
      ]
    </text>
  )
}

export function StudioKeyHint(props: { keyLabel: string; label: string }) {
  const state = useTheme()
  return (
    <text>
      <span style={{ fg: state.theme.text }}>{props.keyLabel}</span>
      <span style={{ fg: state.theme.textMuted }}> {props.label}</span>
    </text>
  )
}
