import type { Argv } from "yargs"
import { Effect, Option } from "effect"
import { effectCmd, fail } from "../effect-cmd"
import { UI } from "../ui"
import * as Prompt from "../effect/prompt"
import { Learning, type LearnerLevel } from "@/learning/learning"
import { Provider } from "@/provider/provider"

const levels = ["beginner", "intermediate", "advanced"] as const

function formatStatus(status: string) {
  if (status === "completed") return "✓"
  if (status === "in_progress") return "•"
  return " "
}

const chooseLevel = Effect.fnUntraced(function* () {
  const selected = yield* Prompt.select<LearnerLevel>({
    message: "Choose your current coding level",
    options: levels.map((level) => ({ value: level, label: level[0].toUpperCase() + level.slice(1) })),
  })
  if (Option.isNone(selected)) return yield* fail("Level selection was cancelled")
  return yield* Learning.setLevel(selected.value)
})

const ensureLevel = Effect.fnUntraced(function* () {
  return (yield* Learning.profile()) ?? (yield* chooseLevel())
})

const LearnListCommand = effectCmd({
  command: "list",
  describe: "list built-in lessons",
  instance: false,
  builder: (yargs: Argv) =>
    yargs.option("level", { type: "string", choices: levels, describe: "filter by learner level" }),
  handler: Effect.fn("Cli.learn.list")(function* (args) {
    const catalog = yield* Learning.catalog()
    const filtered = args.level ? catalog.filter((item) => item.level === args.level) : catalog
    let track = ""
    for (const lesson of filtered) {
      if (lesson.track !== track) {
        track = lesson.track
        UI.empty()
        UI.println(UI.Style.TEXT_HIGHLIGHT_BOLD + track + UI.Style.TEXT_NORMAL)
      }
      UI.println(` ${formatStatus(lesson.progress.status)} ${lesson.id.padEnd(30)} ${lesson.title}`)
    }
  }),
})

const LearnLevelCommand = effectCmd({
  command: "level [level]",
  describe: "show or change your teaching level",
  instance: false,
  builder: (yargs: Argv) => yargs.positional("level", { type: "string", choices: levels }),
  handler: Effect.fn("Cli.learn.level")(function* (args) {
    const level = args.level ? yield* Learning.setLevel(args.level as LearnerLevel) : yield* Learning.profile()
    if (level) {
      UI.println(`Teaching level: ${level}`)
      return
    }
    UI.println(`Teaching level: ${yield* chooseLevel()}`)
  }),
})

const LearnStartCommand = effectCmd({
  command: "start <lesson-id>",
  describe: "start or resume a lesson",
  instance: false,
  builder: (yargs: Argv) =>
    yargs
      .positional("lesson-id", { type: "string", demandOption: true })
      .option("reset", { type: "boolean", default: false, describe: "replace the lesson workspace with starter files" })
      .option("force", { type: "boolean", default: false, describe: "confirm a destructive lesson reset" })
      .option("tui", { type: "boolean", default: true, describe: "open the tutor after scaffolding" }),
  handler: Effect.fn("Cli.learn.start")(function* (args) {
    const level = yield* ensureLevel()
    if (args.reset && !args.force)
      return yield* fail("Reset replaces the lesson workspace. Re-run with --reset --force to confirm.")
    const result = yield* Learning.start(args["lesson-id"], args.reset).pipe(
      Effect.catch((error) => fail(error.message)),
    )
    UI.println(`${result.resumed ? "Resuming" : "Started"} ${result.lesson.title}`)
    UI.println(`Workspace: ${result.workspace}`)
    if (!args.tui) return undefined
    const provider = yield* Provider.Service
    const model = yield* provider.defaultModel().pipe(Effect.option)
    if (Option.isNone(model)) {
      UI.empty()
      UI.println("The lesson workspace is ready, but no AI model is connected.")
      UI.println("Run `codetutor auth login`, choose a provider, then resume with:")
      UI.println(`  codetutor learn start ${result.lesson.id}`)
      return undefined
    }
    UI.println(`Opening the ${level} tutor…`)
    const prompt = [
      `We are working on CodeTutor lesson ${result.lesson.id}: ${result.lesson.title}.`,
      result.lesson.mentorContext,
      `Objectives: ${result.lesson.objectives.join(" ")}`,
      "Begin by asking the learner to explain what the starter code currently does. Do not reveal the solution unless explicitly requested.",
    ].join("\n")
    const argv = process.argv[1]?.endsWith(".ts")
      ? [process.execPath, process.argv[1], result.workspace, "--agent", "tutor", "--prompt", prompt]
      : [process.execPath, result.workspace, "--agent", "tutor", "--prompt", prompt]
    const proc = Bun.spawn(argv, { stdin: "inherit", stdout: "inherit", stderr: "inherit", env: process.env })
    yield* Effect.promise(() => proc.exited)
    return undefined
  }),
})

const LearnResumeCommand = effectCmd({
  command: "resume",
  describe: "show the most recently active lesson",
  instance: false,
  handler: Effect.fn("Cli.learn.resume")(function* () {
    const current = yield* Learning.active().pipe(Effect.catch((error) => fail(error.message)))
    UI.println(`${current.lesson.id} — ${current.lesson.title}`)
    UI.println(`Workspace: ${current.progress.workspace ?? "not created"}`)
    UI.println(`Resume with: codetutor learn start ${current.lesson.id}`)
  }),
})

const LearnStatusCommand = effectCmd({
  command: "status",
  describe: "show curriculum progress",
  instance: false,
  handler: Effect.fn("Cli.learn.status")(function* () {
    const catalog = yield* Learning.catalog()
    const completed = catalog.filter((item) => item.progress.status === "completed").length
    const active = catalog.filter((item) => item.progress.status === "in_progress").length
    UI.println(`Progress: ${completed}/${catalog.length} lessons completed`)
    UI.println(`In progress: ${active}`)
    UI.println(`Teaching level: ${(yield* Learning.profile()) ?? "not selected"}`)
  }),
})

const LearnCheckCommand = effectCmd({
  command: "check [lesson-id]",
  describe: "run deterministic checks for a lesson",
  instance: false,
  builder: (yargs: Argv) => yargs.positional("lesson-id", { type: "string" }),
  handler: Effect.fn("Cli.learn.check")(function* (args) {
    const result = yield* Learning.check(args["lesson-id"]).pipe(Effect.catch((error) => fail(error.message)))
    if (result.stdout.trim()) UI.println(result.stdout.trim())
    if (result.stderr.trim()) UI.println(result.stderr.trim())
    if (!result.passed) return yield* fail(`Lesson check failed with exit code ${result.exitCode}`)
    UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Lesson complete!" + UI.Style.TEXT_NORMAL)
    return undefined
  }),
})

const LearnHintCommand = effectCmd({
  command: "hint [lesson-id]",
  describe: "show the next layered hint",
  instance: false,
  builder: (yargs: Argv) => yargs.positional("lesson-id", { type: "string" }),
  handler: Effect.fn("Cli.learn.hint")(function* (args) {
    const result = yield* Learning.hint(args["lesson-id"]).pipe(Effect.catch((error) => fail(error.message)))
    UI.println(`${result.exhausted ? "All hints revealed" : `Hint ${result.index}/${result.total}`}: ${result.hint}`)
  }),
})

const LearnSolutionCommand = effectCmd({
  command: "solution [lesson-id]",
  describe: "reveal the solution without overwriting your work",
  instance: false,
  builder: (yargs: Argv) => yargs.positional("lesson-id", { type: "string" }),
  handler: Effect.fn("Cli.learn.solution")(function* (args) {
    const result = yield* Learning.revealSolution(args["lesson-id"]).pipe(
      Effect.catch((error) => fail(error instanceof Error ? error.message : String(error))),
    )
    for (const diff of Object.values(result.diffs)) {
      UI.println(diff)
    }
  }),
})

const LearnResetCommand = effectCmd({
  command: "reset <lesson-id>",
  describe: "restore a lesson's starter files",
  instance: false,
  builder: (yargs: Argv) =>
    yargs
      .positional("lesson-id", { type: "string", demandOption: true })
      .option("force", { type: "boolean", default: false, describe: "confirm destructive workspace reset" }),
  handler: Effect.fn("Cli.learn.reset")(function* (args) {
    if (!args.force) return yield* fail("Reset replaces the lesson workspace. Re-run with --force to confirm.")
    const result = yield* Learning.reset(args["lesson-id"]).pipe(Effect.catch((error) => fail(error.message)))
    UI.println(`Reset ${result.lesson.title}`)
    UI.println(`Workspace: ${result.workspace}`)
    return undefined
  }),
})

export const LearnCommand = effectCmd({
  command: "learn",
  describe: "learn JavaScript and TypeScript with guided lessons",
  instance: false,
  builder: (yargs: Argv) =>
    yargs
      .command(LearnListCommand)
      .command(LearnStartCommand)
      .command(LearnResumeCommand)
      .command(LearnStatusCommand)
      .command(LearnCheckCommand)
      .command(LearnHintCommand)
      .command(LearnSolutionCommand)
      .command(LearnResetCommand)
      .command(LearnLevelCommand),
  handler: Effect.fn("Cli.learn")(function* () {
    yield* ensureLevel()
    const catalog = yield* Learning.catalog()
    const completed = catalog.filter((item) => item.progress.status === "completed").length
    UI.println(UI.Style.TEXT_HIGHLIGHT_BOLD + "CodeTutor curriculum" + UI.Style.TEXT_NORMAL)
    UI.println(`${catalog.length} lessons · ${completed} completed`)
    UI.println("Run `codetutor learn list` to browse or `codetutor learn start <lesson-id>` to begin.")
  }),
})
