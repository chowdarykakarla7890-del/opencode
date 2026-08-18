import { createStore } from "solid-js/store"
import { For, Show } from "solid-js"
import { useLanguage } from "@/context/language"

const examples = ["builder.example.store", "builder.example.portfolio", "builder.example.tracker"] as const
const files = ["app.tsx", "components/dashboard.tsx", "styles.css"] as const

export function PromptBuilder() {
  const language = useLanguage()
  const [state, setState] = createStore({
    prompt: "A mindful habit tracker for busy people",
    title: "Habitly",
    generating: false,
    generated: true,
    published: false,
    copied: false,
    file: "app.tsx" as (typeof files)[number],
    tab: "preview" as "preview" | "code",
  })

  const generate = () => {
    if (!state.prompt.trim() || state.generating) return
    setState("generating", true)
    window.setTimeout(() => {
      setState({
        title: state.prompt.trim().split(" ").slice(0, 2).join(" "),
        generated: true,
        generating: false,
        published: false,
        tab: "preview",
      })
    }, 700)
  }

  const url = () => `sparkly.app/${state.title.toLowerCase().replaceAll(" ", "-")}`

  const share = () => {
    void navigator.clipboard.writeText(`https://${url()}`)
    setState("copied", true)
    window.setTimeout(() => setState("copied", false), 1500)
  }

  const source = () => {
    if (state.file === "components/dashboard.tsx") {
      return `type DashboardProps = {
  project: { name: string; brief: string }
}

export function Dashboard(props: DashboardProps) {
  return (
    <main>
      <p>{props.project.brief}</p>
      <h1>{props.project.name}</h1>
    </main>
  )
}`
    }

    if (state.file === "styles.css") {
      return `:root {
  color: #31443a;
  background: #f5f7f2;
}

main { max-width: 720px; margin: 0 auto; }`
    }

    return `import { Dashboard } from "./components/dashboard"
import "./styles.css"

const project = {
  name: ${JSON.stringify(state.title)},
  brief: ${JSON.stringify(state.prompt)},
}

export default function App() {
  return <Dashboard project={project} />
}`
  }

  return (
    <main class="builder-shell">
      <header class="builder-header">
        <a class="builder-logo" href="/builder" aria-label={language.t("builder.home")}>spark<span>ly</span></a>
        <nav class="builder-nav" aria-label={language.t("builder.navigation")}>
          <a href="#projects">{language.t("builder.projects")}</a>
          <a href="#templates">{language.t("builder.templates")}</a>
        </nav>
        <button class="builder-avatar" type="button" aria-label={language.t("builder.account")}>I</button>
      </header>

      <section class="builder-workspace">
        <div class="builder-intro">
          <p class="builder-kicker">{language.t("builder.kicker")}</p>
          <h1>{language.t("builder.title")}</h1>
          <p>{language.t("builder.subtitle")}</p>
        </div>

        <div class="builder-prompt-card">
          <label for="builder-prompt">{language.t("builder.prompt.label")}</label>
          <textarea
            id="builder-prompt"
            value={state.prompt}
            onInput={(event) => setState("prompt", event.currentTarget.value)}
            placeholder={language.t("builder.prompt.placeholder")}
          />
          <div class="builder-prompt-footer">
            <span>{language.t("builder.prompt.hint")}</span>
            <button class="builder-generate" type="button" onClick={generate} disabled={state.generating || !state.prompt.trim()}>
              {state.generating ? language.t("builder.generating") : language.t("builder.generate")}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>

        <div class="builder-examples" id="templates">
          <span>{language.t("builder.try")}</span>
          <For each={examples}>
            {(example) => (
              <button type="button" onClick={() => setState("prompt", language.t(example))}>
                {language.t(example)}
              </button>
            )}
          </For>
        </div>
      </section>

      <section class="builder-output" id="projects">
        <div class="builder-output-header">
          <div>
            <p>{language.t("builder.output.label")}</p>
            <h2>{state.title}</h2>
          </div>
          <div class="builder-actions">
            <button type="button" onClick={share}>
              {state.copied ? language.t("builder.copied") : language.t("builder.share")}
            </button>
            <button
              class="builder-publish"
              type="button"
              onClick={() => setState("published", !state.published)}
            >
              {state.published ? language.t("builder.published") : language.t("builder.publish")}
            </button>
          </div>
        </div>

        <div class="builder-preview-card">
          <div class="builder-browser-bar">
            <div class="builder-dots"><i /><i /><i /></div>
            <div class="builder-url">{url()}</div>
            <div class="builder-status">● {state.published ? language.t("builder.published") : language.t("builder.live")}</div>
          </div>
          <div class="builder-tabs" role="tablist" aria-label={language.t("builder.view") }>
            <button
              classList={{ active: state.tab === "preview" }}
              type="button"
              role="tab"
              aria-selected={state.tab === "preview"}
              onClick={() => setState("tab", "preview")}
            >
              {language.t("builder.preview")}
            </button>
            <button
              classList={{ active: state.tab === "code" }}
              type="button"
              role="tab"
              aria-selected={state.tab === "code"}
              onClick={() => setState("tab", "code")}
            >
              {language.t("builder.code")}
            </button>
          </div>
          <Show
            when={state.tab === "preview"}
            fallback={
              <div class="builder-code-space">
                <aside aria-label={language.t("builder.code.files")}>
                  <p>{language.t("builder.code.files")}</p>
                  <For each={files}>
                    {(file) => (
                      <button
                        type="button"
                        classList={{ active: state.file === file }}
                        onClick={() => setState("file", file)}
                      >
                        {file}
                      </button>
                    )}
                  </For>
                </aside>
                <div class="builder-editor">
                  <div class="builder-editor-bar">
                    <span>{state.file}</span>
                    <span>{language.t("builder.code.generated")}</span>
                  </div>
                  <pre class="builder-code"><code>{source()}</code></pre>
                </div>
              </div>
            }
          >
            <div class="habit-preview">
              <div class="habit-nav"><strong>{state.title}</strong><span>{language.t("builder.preview.today")}</span><button>{language.t("builder.preview.profile")}</button></div>
              <div class="habit-content">
                <div><p>{language.t("builder.preview.greeting")}</p><h3>{language.t("builder.preview.heading")}</h3></div>
                <div class="habit-progress"><span>{language.t("builder.preview.progress")}</span><strong>3 / 5</strong><div><i /></div></div>
                <div class="habit-list">
                  <article><b>✓</b><span>{language.t("builder.preview.habit1")}</span><em>8:00</em></article>
                  <article><b>✓</b><span>{language.t("builder.preview.habit2")}</span><em>12:30</em></article>
                  <article><b>○</b><span>{language.t("builder.preview.habit3")}</span><em>18:00</em></article>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </section>
    </main>
  )
}
