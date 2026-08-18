import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"
import { described } from "./metadata"

const root = "/learning"

export const LearnerLevel = Schema.Literals(["beginner", "intermediate", "advanced"])
export const LessonStatus = Schema.Literals(["not_started", "in_progress", "completed"])

export const LessonProgress = Schema.Struct({
  lessonID: Schema.String,
  status: LessonStatus,
  workspace: Schema.optional(Schema.String),
  attempts: Schema.Number,
  hintIndex: Schema.Number,
  solutionRevealed: Schema.Boolean,
  startedAt: Schema.optional(Schema.Number),
  completedAt: Schema.optional(Schema.Number),
})

export const LessonSummary = Schema.Struct({
  id: Schema.String,
  version: Schema.Number,
  track: Schema.String,
  order: Schema.Number,
  title: Schema.String,
  concept: Schema.String,
  level: LearnerLevel,
  prerequisites: Schema.Array(Schema.String),
  objectives: Schema.Array(Schema.String),
  estimatedMinutes: Schema.Number,
  rubric: Schema.Array(Schema.String),
  progress: LessonProgress,
})

export const CheckResult = Schema.Struct({
  lessonID: Schema.String,
  passed: Schema.Boolean,
  exitCode: Schema.Number,
  stdout: Schema.String,
  stderr: Schema.String,
  durationMs: Schema.Number,
  completed: Schema.Boolean,
})

const Profile = Schema.Struct({ level: Schema.NullOr(LearnerLevel) })
const ProfilePayload = Schema.Struct({ level: LearnerLevel })
const StartPayload = Schema.Struct({ reset: Schema.optional(Schema.Boolean) })
const StartResult = Schema.Struct({
  lessonID: Schema.String,
  title: Schema.String,
  workspace: Schema.String,
  resumed: Schema.Boolean,
})
const ActiveResult = Schema.Struct({ lesson: LessonSummary, progress: LessonProgress })
const HintResult = Schema.Struct({
  hint: Schema.String,
  index: Schema.Number,
  total: Schema.Number,
  exhausted: Schema.Boolean,
})
const SolutionResult = Schema.Struct({
  lessonID: Schema.String,
  files: Schema.Record(Schema.String, Schema.String),
  diffs: Schema.Record(Schema.String, Schema.String),
})

export const LearningApi = HttpApi.make("learning").add(
  HttpApiGroup.make("learning")
    .add(
      HttpApiEndpoint.get("catalog", `${root}/catalog`, {
        query: WorkspaceRoutingQuery,
        success: described(Schema.Array(LessonSummary), "CodeTutor lesson catalog"),
      }).annotateMerge(OpenApi.annotations({ identifier: "learning.catalog", summary: "List lessons" })),
      HttpApiEndpoint.get("profile", `${root}/profile`, {
        query: WorkspaceRoutingQuery,
        success: Profile,
      }).annotateMerge(OpenApi.annotations({ identifier: "learning.profile", summary: "Get learner profile" })),
      HttpApiEndpoint.patch("setProfile", `${root}/profile`, {
        query: WorkspaceRoutingQuery,
        payload: ProfilePayload,
        success: Profile,
      }).annotateMerge(OpenApi.annotations({ identifier: "learning.setProfile", summary: "Set learner level" })),
      HttpApiEndpoint.get("progress", `${root}/progress`, {
        query: WorkspaceRoutingQuery,
        success: Schema.Array(LessonProgress),
      }).annotateMerge(OpenApi.annotations({ identifier: "learning.progress", summary: "Get lesson progress" })),
      HttpApiEndpoint.get("resume", `${root}/resume`, {
        query: WorkspaceRoutingQuery,
        success: ActiveResult,
        error: HttpApiError.BadRequest,
      }).annotateMerge(OpenApi.annotations({ identifier: "learning.resume", summary: "Get active lesson" })),
      HttpApiEndpoint.post("start", `${root}/lessons/:lessonID/start`, {
        params: { lessonID: Schema.String },
        query: WorkspaceRoutingQuery,
        payload: StartPayload,
        success: StartResult,
        error: HttpApiError.BadRequest,
      }).annotateMerge(OpenApi.annotations({ identifier: "learning.start", summary: "Start or resume a lesson" })),
      HttpApiEndpoint.post("check", `${root}/lessons/:lessonID/check`, {
        params: { lessonID: Schema.String },
        query: WorkspaceRoutingQuery,
        success: CheckResult,
        error: HttpApiError.BadRequest,
      }).annotateMerge(OpenApi.annotations({ identifier: "learning.check", summary: "Validate a lesson" })),
      HttpApiEndpoint.post("hint", `${root}/lessons/:lessonID/hint`, {
        params: { lessonID: Schema.String },
        query: WorkspaceRoutingQuery,
        success: HintResult,
        error: HttpApiError.BadRequest,
      }).annotateMerge(OpenApi.annotations({ identifier: "learning.hint", summary: "Reveal the next hint" })),
      HttpApiEndpoint.post("solution", `${root}/lessons/:lessonID/solution`, {
        params: { lessonID: Schema.String },
        query: WorkspaceRoutingQuery,
        success: SolutionResult,
        error: HttpApiError.BadRequest,
      }).annotateMerge(OpenApi.annotations({ identifier: "learning.solution", summary: "Reveal a solution diff" })),
      HttpApiEndpoint.post("reset", `${root}/lessons/:lessonID/reset`, {
        params: { lessonID: Schema.String },
        query: WorkspaceRoutingQuery,
        success: StartResult,
        error: HttpApiError.BadRequest,
      }).annotateMerge(OpenApi.annotations({ identifier: "learning.reset", summary: "Reset a lesson workspace" })),
    )
    .annotateMerge(OpenApi.annotations({ title: "learning", description: "CodeTutor curriculum and progress." }))
    .middleware(InstanceContextMiddleware)
    .middleware(WorkspaceRoutingMiddleware)
    .middleware(Authorization),
)
