import type { LessonSummary } from "@opencode-ai/sdk/v2"

export function learningStats(lessons: LessonSummary[]) {
  return {
    completed: lessons.filter((lesson) => lesson.progress.status === "completed").length,
    inProgress: lessons.filter((lesson) => lesson.progress.status === "in_progress").length,
    total: lessons.length,
  }
}
