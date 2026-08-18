import { expect, test } from "bun:test"
import type { LessonSummary } from "@opencode-ai/sdk/v2"
import { learningStats } from "./learning-model"

const lesson = (status: LessonSummary["progress"]["status"]): LessonSummary =>
  ({ progress: { status } }) as LessonSummary

test("learningStats summarizes local lesson state", () => {
  expect(learningStats([lesson("completed"), lesson("in_progress"), lesson("not_started")])).toEqual({
    completed: 1,
    inProgress: 1,
    total: 3,
  })
})
