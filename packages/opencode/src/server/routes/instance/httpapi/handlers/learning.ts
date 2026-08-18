import { Learning, type Lesson, type Progress } from "@/learning/learning"
import { Effect } from "effect"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"

const badRequest = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.mapError(() => new HttpApiError.BadRequest({})))

const summary = (lesson: Lesson & { progress: Progress }) => ({
  id: lesson.id,
  version: lesson.version,
  track: lesson.track,
  order: lesson.order,
  title: lesson.title,
  concept: lesson.concept,
  level: lesson.level,
  prerequisites: lesson.prerequisites,
  objectives: lesson.objectives,
  estimatedMinutes: lesson.estimatedMinutes,
  rubric: lesson.rubric,
  progress: lesson.progress,
})

export const learningHandlers = HttpApiBuilder.group(InstanceHttpApi, "learning", (handlers) =>
  handlers
    .handle("catalog", () => Learning.catalog().pipe(Effect.map((items) => items.map(summary))))
    .handle("profile", () => Learning.profile().pipe(Effect.map((level) => ({ level: level ?? null }))))
    .handle("setProfile", (ctx) => Learning.setLevel(ctx.payload.level).pipe(Effect.map((level) => ({ level }))))
    .handle("progress", () => Learning.progressList())
    .handle("resume", () =>
      badRequest(Learning.active()).pipe(
        Effect.map(({ lesson, progress }) => ({ lesson: summary({ ...lesson, progress }), progress })),
      ),
    )
    .handle("start", (ctx) =>
      badRequest(Learning.start(ctx.params.lessonID, ctx.payload.reset ?? false)).pipe(
        Effect.map((result) => ({
          lessonID: result.lesson.id,
          title: result.lesson.title,
          workspace: result.workspace,
          resumed: result.resumed,
        })),
      ),
    )
    .handle("check", (ctx) => badRequest(Learning.check(ctx.params.lessonID)))
    .handle("hint", (ctx) => badRequest(Learning.hint(ctx.params.lessonID)))
    .handle("solution", (ctx) => badRequest(Learning.revealSolution(ctx.params.lessonID)))
    .handle("reset", (ctx) =>
      badRequest(Learning.reset(ctx.params.lessonID)).pipe(
        Effect.map((result) => ({
          lessonID: result.lesson.id,
          title: result.lesson.title,
          workspace: result.workspace,
          resumed: result.resumed,
        })),
      ),
    ),
)
