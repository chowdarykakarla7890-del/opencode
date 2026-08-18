import { expect, test } from "@playwright/test"
import { mockCodeTutorServer } from "../utils/mock-server"

const directory = "C:/CodeTutor/Projects/demo"
const workspace = "C:/CodeTutor/Lessons/js-01-values"

test("starts, checks, completes, and resets a lesson from the Learning dashboard", async ({ page }) => {
  let level: "beginner" | "intermediate" | "advanced" = "beginner"
  let status: "not_started" | "in_progress" | "completed" = "not_started"

  const progress = () => ({
    lessonID: "js-01-values",
    status,
    workspace: status === "not_started" ? undefined : workspace,
    attempts: status === "completed" ? 1 : 0,
    hintIndex: 0,
    solutionRevealed: false,
  })
  const catalog = () => [
    {
      id: "js-01-values",
      version: 1,
      track: "JavaScript Foundations",
      order: 1,
      title: "Values and Variables",
      concept: "Store and inspect JavaScript values.",
      level: "beginner",
      prerequisites: [],
      objectives: ["Declare variables with const and let"],
      estimatedMinutes: 15,
      rubric: ["Uses the requested declarations"],
      progress: progress(),
    },
  ]

  await mockCodeTutorServer(page, {
    directory,
    project: {
      id: "proj_learning_flow",
      worktree: directory,
      vcs: "git",
      name: "demo",
      time: { created: 1_700_000_000_000, updated: 1_700_000_000_000 },
      sandboxes: [],
    },
    provider: { all: [], connected: [], default: {} },
    sessions: [],
    pageMessages: () => ({ items: [] }),
    learning: {
      catalog,
      profile: () => ({ level }),
      setProfile: (body) => {
        level = (body as { level: typeof level }).level
        return { level }
      },
      start: (lessonID) => {
        status = "in_progress"
        return { lessonID, title: "Values and Variables", workspace, resumed: false }
      },
      check: (lessonID) => {
        status = "completed"
        return {
          lessonID,
          passed: true,
          exitCode: 0,
          stdout: "All checks passed",
          stderr: "",
          durationMs: 12,
          completed: true,
        }
      },
      reset: (lessonID) => {
        status = "in_progress"
        return { lessonID, title: "Values and Variables", workspace, resumed: false }
      },
    },
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
    localStorage.setItem("opencode.global.dat:server", JSON.stringify({ projects: { local: [] } }))
  })

  await page.goto("/learning")
  await expect(page.getByRole("heading", { name: "Learn with CodeTutor" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Values and Variables" })).toBeVisible()
  await expect(page.getByText("0/1", { exact: true })).toBeVisible()

  const levelSelect = page.getByLabel("Teaching level")
  await levelSelect.selectOption("intermediate")
  await expect(levelSelect).toHaveValue("intermediate")
  await expect(page.getByText("Teaching level updated.")).toBeVisible()

  await page.getByRole("button", { name: "Start lesson" }).click()
  await expect(page.getByText("Lesson workspace is ready.")).toBeVisible()
  await expect(page.getByText(workspace, { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Resume lesson" })).toBeVisible()

  await page.getByRole("button", { name: "Run check" }).click()
  await expect(page.getByText("Check passed — lesson complete")).toBeVisible()
  await expect(page.getByText("All checks passed", { exact: true })).toBeVisible()
  await expect(page.getByText("1/1", { exact: true })).toBeVisible()

  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Reset" }).click()
  await expect(page.getByText("Lesson reset to its starter files.")).toBeVisible()
  await expect(page.getByText("0/1", { exact: true })).toBeVisible()
})
