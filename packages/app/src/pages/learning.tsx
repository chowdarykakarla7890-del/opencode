import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import type { CheckResult, LearnerLevel } from "@opencode-ai/sdk/v2"
import { Button } from "@opencode-ai/ui/button"
import { A } from "@solidjs/router"
import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { learningStats } from "./learning-model"

const levels: LearnerLevel[] = ["beginner", "intermediate", "advanced"]

export default function LearningPage() {
  const language = useLanguage()
  const server = useServerSDK()
  const [selectedID, setSelectedID] = createSignal<string>()
  const [busy, setBusy] = createSignal(false)
  const [message, setMessage] = createSignal("")
  const [result, setResult] = createSignal<CheckResult>()

  const [catalog, catalogActions] = createResource(async () => {
    const response = await server().client.learning.catalog()
    if (response.error) throw response.error
    return response.data ?? []
  })
  const [profile, profileActions] = createResource(async () => {
    const response = await server().client.learning.profile()
    if (response.error) throw response.error
    return response.data
  })
  const selected = createMemo(() => catalog()?.find((lesson) => lesson.id === selectedID()) ?? catalog()?.[0])
  const stats = createMemo(() => learningStats(catalog() ?? []))

  const refresh = async () => {
    await Promise.all([catalogActions.refetch(), profileActions.refetch()])
  }

  const action = async (run: () => Promise<{ data?: unknown; error?: unknown }>, success: string) => {
    setBusy(true)
    setMessage("")
    try {
      const response = await run()
      if (response.error) throw response.error
      setMessage(success)
      await refresh()
      return response.data
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const start = async () => {
    const lesson = selected()
    if (!lesson) return
    await action(
      () => server().client.learning.start({ lessonID: lesson.id, reset: false }),
      language.t("learning.action.started"),
    )
  }

  const check = async () => {
    const lesson = selected()
    if (!lesson) return
    const data = await action(
      () => server().client.learning.check({ lessonID: lesson.id }),
      language.t("learning.action.checked"),
    )
    setResult(data as CheckResult | undefined)
  }

  const reset = async () => {
    const lesson = selected()
    if (!lesson || !window.confirm(language.t("learning.reset.confirm"))) return
    await action(
      () => server().client.learning.reset({ lessonID: lesson.id }),
      language.t("learning.action.reset"),
    )
  }

  const setLevel = async (level: LearnerLevel) => {
    await action(
      () => server().client.learning.setProfile({ level }),
      language.t("learning.action.levelUpdated"),
    )
  }

  return (
    <div class="m-2 min-h-0 flex-1 self-stretch overflow-auto rounded-[10px] bg-v2-background-bg-base p-6">
      <div class="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <A href="/" class="text-12-regular text-text-weak hover:text-text-strong">
              {language.t("learning.back")}
            </A>
            <h1 class="mt-2 text-24-medium text-text-strong">{language.t("learning.title")}</h1>
            <p class="mt-1 text-14-regular text-text-weak">{language.t("learning.description")}</p>
          </div>
          <label class="flex items-center gap-2 text-13-regular text-text-weak">
            {language.t("learning.level")}
            <select
              class="rounded-md border border-border-weak-base bg-background-base px-3 py-2 text-text-strong"
              value={profile()?.level ?? "beginner"}
              disabled={busy()}
              onChange={(event) => void setLevel(event.currentTarget.value as LearnerLevel)}
            >
              <For each={levels}>
                {(level) => <option value={level}>{language.t(`learning.level.${level}`)}</option>}
              </For>
            </select>
          </label>
        </header>

        <section class="grid grid-cols-3 gap-3">
          <Stat label={language.t("learning.stats.completed")} value={`${stats().completed}/${stats().total}`} />
          <Stat label={language.t("learning.stats.inProgress")} value={String(stats().inProgress)} />
          <Stat label={language.t("learning.stats.tracks")} value={String(new Set((catalog() ?? []).map((x) => x.track)).size)} />
        </section>

        <Show when={!catalog.loading} fallback={<div>{language.t("common.loading")}</div>}>
          <div class="grid min-h-[520px] gap-4 md:grid-cols-[360px_1fr]">
            <div class="overflow-auto rounded-lg border border-border-weak-base p-2">
              <For each={catalog()}>
                {(lesson) => (
                  <button
                    class="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-background-weak-base"
                    classList={{ "bg-background-weak-base": selected()?.id === lesson.id }}
                    onClick={() => setSelectedID(lesson.id)}
                  >
                    <span class="w-4 text-center text-12-medium text-text-weak">
                      {lesson.progress.status === "completed" ? "✓" : lesson.progress.status === "in_progress" ? "•" : ""}
                    </span>
                    <span class="min-w-0">
                      <span class="block truncate text-13-medium text-text-strong">{lesson.title}</span>
                      <span class="block truncate text-11-regular text-text-weak">{lesson.track}</span>
                    </span>
                  </button>
                )}
              </For>
            </div>

            <Show when={selected()} keyed>
              {(lesson) => (
                <article class="rounded-lg border border-border-weak-base p-5">
                  <div class="text-11-medium uppercase tracking-wide text-text-weak">{lesson.id}</div>
                  <h2 class="mt-1 text-20-medium text-text-strong">{lesson.title}</h2>
                  <p class="mt-2 text-13-regular text-text-weak">
                    {lesson.estimatedMinutes} {language.t("learning.minutes")} · {language.t(`learning.level.${lesson.level}`)}
                  </p>
                  <h3 class="mt-6 text-13-medium text-text-strong">{language.t("learning.objectives")}</h3>
                  <ul class="mt-2 list-disc space-y-1 pl-5 text-13-regular text-text-weak">
                    <For each={lesson.objectives}>{(objective) => <li>{objective}</li>}</For>
                  </ul>
                  <Show when={lesson.progress.workspace}>
                    {(workspace) => (
                      <div class="mt-5 rounded-md bg-background-weak-base p-3">
                        <div class="text-11-medium text-text-weak">{language.t("learning.workspace")}</div>
                        <code class="mt-1 block break-all text-12-regular text-text-strong">{workspace()}</code>
                      </div>
                    )}
                  </Show>
                  <div class="mt-6 flex flex-wrap gap-2">
                    <Button disabled={busy()} onClick={() => void start()}>
                      {lesson.progress.status === "not_started"
                        ? language.t("learning.start")
                        : language.t("learning.resume")}
                    </Button>
                    <Button disabled={busy() || lesson.progress.status === "not_started"} onClick={() => void check()}>
                      {language.t("learning.check")}
                    </Button>
                    <Button variant="ghost" disabled={busy()} onClick={() => void reset()}>
                      {language.t("learning.reset")}
                    </Button>
                  </div>
                  <Show when={message()}>
                    <p class="mt-4 text-13-regular text-text-weak">{message()}</p>
                  </Show>
                  <Show when={result()} keyed>
                    {(checkResult) => (
                      <div class="mt-4 rounded-md border border-border-weak-base p-3">
                        <div class="text-13-medium text-text-strong">
                          {checkResult.passed ? language.t("learning.check.passed") : language.t("learning.check.failed")}
                        </div>
                        <pre class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-11-regular text-text-weak">
                          {checkResult.stdout || checkResult.stderr}
                        </pre>
                      </div>
                    )}
                  </Show>
                </article>
              )}
            </Show>
          </div>
        </Show>
      </div>
    </div>
  )
}

function Stat(props: { label: string; value: string }) {
  return (
    <div class="rounded-lg border border-border-weak-base p-4">
      <div class="text-11-medium text-text-weak">{props.label}</div>
      <div class="mt-1 text-20-medium text-text-strong">{props.value}</div>
    </div>
  )
}
