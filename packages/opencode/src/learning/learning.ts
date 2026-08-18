import { lessons, getLesson, type LearnerLevel, type Lesson, type LessonStatus } from "@codetutor/curriculum"
import { Database } from "@opencode-ai/core/database/database"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Global } from "@opencode-ai/core/global"
import { LearningProfileTable, LessonProgressTable } from "@opencode-ai/core/learning/sql"
import { desc, eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import path from "path"

export { type LearnerLevel, type Lesson, type LessonStatus }

export type Progress = {
  lessonID: string
  status: LessonStatus
  workspace?: string
  attempts: number
  hintIndex: number
  solutionRevealed: boolean
  startedAt?: number
  completedAt?: number
}

export type CheckResult = {
  lessonID: string
  passed: boolean
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  completed: boolean
}

export class LessonNotFoundError extends Schema.TaggedErrorClass<LessonNotFoundError>()("LessonNotFoundError", {
  lessonID: Schema.String,
}) {
  override get message() {
    return `Unknown lesson: ${this.lessonID}`
  }
}

export class NoActiveLessonError extends Schema.TaggedErrorClass<NoActiveLessonError>()("NoActiveLessonError", {}) {
  override get message() {
    return "No lesson is in progress. Start one with `codetutor learn start <lesson-id>`."
  }
}

const PROFILE_ID = 1

export const profile = Effect.fn("Learning.profile")(function* () {
  const { db } = yield* Database.Service
  const row = yield* db
    .select()
    .from(LearningProfileTable)
    .where(eq(LearningProfileTable.id, PROFILE_ID))
    .get()
    .pipe(Effect.orDie)
  return row?.level
})

export const setLevel = Effect.fn("Learning.setLevel")(function* (level: LearnerLevel) {
  const { db } = yield* Database.Service
  yield* db
    .insert(LearningProfileTable)
    .values({ id: PROFILE_ID, level })
    .onConflictDoUpdate({ target: LearningProfileTable.id, set: { level, time_updated: Date.now() } })
    .run()
    .pipe(Effect.orDie)
  return level
})

export const catalog = Effect.fn("Learning.catalog")(function* () {
  const progress = yield* progressList()
  return lessons.map((lesson) => ({
    ...lesson,
    progress: progress.find((item) => item.lessonID === lesson.id) ?? emptyProgress(lesson.id),
  }))
})

export const progressList = Effect.fn("Learning.progressList")(function* () {
  const { db } = yield* Database.Service
  const rows = yield* db.select().from(LessonProgressTable).all().pipe(Effect.orDie)
  return rows.map(toProgress)
})

export const active = Effect.fn("Learning.active")(function* () {
  const { db } = yield* Database.Service
  const row = yield* db
    .select()
    .from(LessonProgressTable)
    .where(eq(LessonProgressTable.status, "in_progress"))
    .orderBy(desc(LessonProgressTable.time_updated))
    .get()
    .pipe(Effect.orDie)
  if (!row) return yield* new NoActiveLessonError()
  const lesson = getLesson(row.lesson_id)
  if (!lesson) return yield* new LessonNotFoundError({ lessonID: row.lesson_id })
  return { lesson, progress: toProgress(row) }
})

export const start = Effect.fn("Learning.start")(function* (lessonID: string, reset = false) {
  const lesson = getLesson(lessonID)
  if (!lesson) return yield* new LessonNotFoundError({ lessonID })
  const { db } = yield* Database.Service
  const fs = yield* FSUtil.Service
  const workspace = path.join(Global.Path.data, "learn", lesson.id)
  const existing = yield* db
    .select()
    .from(LessonProgressTable)
    .where(eq(LessonProgressTable.lesson_id, lesson.id))
    .get()
    .pipe(Effect.orDie)

  if (reset) yield* fs.remove(workspace, { recursive: true, force: true }).pipe(Effect.orDie)
  const exists = yield* fs.existsSafe(workspace)
  if (!exists || reset) {
    yield* fs.ensureDir(workspace).pipe(Effect.orDie)
    yield* Effect.forEach(
      Object.entries(lesson.files),
      ([name, content]) => fs.writeWithDirs(path.join(workspace, name), content).pipe(Effect.orDie),
      { concurrency: "unbounded" },
    )
  }

  const now = Date.now()
  yield* db
    .insert(LessonProgressTable)
    .values({
      lesson_id: lesson.id,
      status: "in_progress",
      workspace,
      attempts: reset ? 0 : (existing?.attempts ?? 0),
      hint_index: reset ? 0 : (existing?.hint_index ?? 0),
      solution_revealed: reset ? false : (existing?.solution_revealed ?? false),
      time_started: reset ? now : (existing?.time_started ?? now),
      time_completed: reset ? null : existing?.time_completed,
    })
    .onConflictDoUpdate({
      target: LessonProgressTable.lesson_id,
      set: {
        status: "in_progress",
        workspace,
        attempts: reset ? 0 : (existing?.attempts ?? 0),
        hint_index: reset ? 0 : (existing?.hint_index ?? 0),
        solution_revealed: reset ? false : (existing?.solution_revealed ?? false),
        time_started: reset ? now : (existing?.time_started ?? now),
        time_completed: reset ? null : existing?.time_completed,
        time_updated: now,
      },
    })
    .run()
    .pipe(Effect.orDie)

  return { lesson, workspace, resumed: Boolean(existing && !reset) }
})

export const check = Effect.fn("Learning.check")(function* (lessonID?: string) {
  const current = lessonID ? yield* progressFor(lessonID) : yield* active()
  const lesson = "lesson" in current ? current.lesson : getLesson(lessonID!)
  const progress = "progress" in current ? current.progress : current
  if (!lesson) return yield* new LessonNotFoundError({ lessonID: lessonID! })
  if (!progress.workspace) return yield* new NoActiveLessonError()

  const started = Date.now()
  const result = yield* Effect.tryPromise({
    try: async () => {
      const proc = Bun.spawn(lesson.check.command, {
        cwd: progress.workspace,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, NO_COLOR: "1" },
      })
      const timer = setTimeout(() => proc.kill(), lesson.check.timeoutMs)
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]).finally(() => clearTimeout(timer))
      return { stdout, stderr, exitCode }
    },
    catch: (cause) => new Error(`Lesson check failed to run: ${String(cause)}`),
  }).pipe(Effect.orDie)
  const passed = result.exitCode === 0
  const { db } = yield* Database.Service
  yield* db
    .update(LessonProgressTable)
    .set({
      attempts: progress.attempts + 1,
      status: passed ? "completed" : "in_progress",
      time_completed: passed ? Date.now() : progress.completedAt,
      time_updated: Date.now(),
    })
    .where(eq(LessonProgressTable.lesson_id, lesson.id))
    .run()
    .pipe(Effect.orDie)
  return {
    lessonID: lesson.id,
    passed,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: Date.now() - started,
    completed: passed,
  } satisfies CheckResult
})

export const hint = Effect.fn("Learning.hint")(function* (lessonID?: string) {
  const current = lessonID ? yield* progressFor(lessonID) : yield* active()
  const lesson = "lesson" in current ? current.lesson : getLesson(lessonID!)
  const progress = "progress" in current ? current.progress : current
  if (!lesson) return yield* new LessonNotFoundError({ lessonID: lessonID! })
  const exhausted = progress.hintIndex >= lesson.hints.length
  const index = Math.min(progress.hintIndex, lesson.hints.length - 1)
  const { db } = yield* Database.Service
  yield* db
    .update(LessonProgressTable)
    .set({ hint_index: Math.min(index + 1, lesson.hints.length), time_updated: Date.now() })
    .where(eq(LessonProgressTable.lesson_id, lesson.id))
    .run()
    .pipe(Effect.orDie)
  return { hint: lesson.hints[index], index: index + 1, total: lesson.hints.length, exhausted }
})

export const revealSolution = Effect.fn("Learning.revealSolution")(function* (lessonID?: string) {
  const current = lessonID ? yield* progressFor(lessonID) : yield* active()
  const lesson = "lesson" in current ? current.lesson : getLesson(lessonID!)
  const progress = "progress" in current ? current.progress : current
  if (!lesson) return yield* new LessonNotFoundError({ lessonID: lessonID! })
  if (!progress.workspace) return yield* new NoActiveLessonError()
  const fs = yield* FSUtil.Service
  const diffs = Object.fromEntries(
    yield* Effect.forEach(Object.entries(lesson.solution), ([name, solution]) =>
      Effect.gen(function* () {
        const learner =
          (yield* fs
            .readFileStringSafe(path.join(progress.workspace!, name))
            .pipe(Effect.catch(() => Effect.succeed(undefined)))) ?? ""
        return [name, solutionDiff(name, learner, solution)] as const
      }),
    ),
  )
  const { db } = yield* Database.Service
  yield* db
    .update(LessonProgressTable)
    .set({ solution_revealed: true, time_updated: Date.now() })
    .where(eq(LessonProgressTable.lesson_id, lesson.id))
    .run()
    .pipe(Effect.orDie)
  return { lessonID: lesson.id, files: lesson.solution, diffs }
})

export const reset = Effect.fn("Learning.reset")(function* (lessonID: string) {
  return yield* start(lessonID, true)
})

const progressFor = Effect.fnUntraced(function* (lessonID: string) {
  const lesson = getLesson(lessonID)
  if (!lesson) return yield* new LessonNotFoundError({ lessonID })
  const { db } = yield* Database.Service
  const row = yield* db
    .select()
    .from(LessonProgressTable)
    .where(eq(LessonProgressTable.lesson_id, lessonID))
    .get()
    .pipe(Effect.orDie)
  if (!row) return yield* new NoActiveLessonError()
  return toProgress(row)
})

function emptyProgress(lessonID: string): Progress {
  return { lessonID, status: "not_started", attempts: 0, hintIndex: 0, solutionRevealed: false }
}

function toProgress(row: typeof LessonProgressTable.$inferSelect): Progress {
  return {
    lessonID: row.lesson_id,
    status: row.status,
    workspace: row.workspace,
    attempts: row.attempts,
    hintIndex: row.hint_index,
    solutionRevealed: row.solution_revealed,
    startedAt: row.time_started,
    completedAt: row.time_completed ?? undefined,
  }
}

function solutionDiff(name: string, learner: string, solution: string) {
  if (learner === solution) return `--- learner/${name}\n+++ solution/${name}\n(no differences)`
  const before = learner.split("\n").map((line) => `-${line}`)
  const after = solution.split("\n").map((line) => `+${line}`)
  return [`--- learner/${name}`, `+++ solution/${name}`, ...before, ...after].join("\n")
}

export * as Learning from "./learning"
