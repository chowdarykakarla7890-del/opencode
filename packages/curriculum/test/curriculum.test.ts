import { afterAll, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { getLesson, lessons, tracks, validateCurriculum } from "../src"

const workspaces: string[] = []

afterAll(async () => {
  await Promise.all(workspaces.map((workspace) => rm(workspace, { recursive: true, force: true })))
})

describe("CodeTutor curriculum", () => {
  test("contains the planned 43 lessons across five tracks", () => {
    expect(lessons).toHaveLength(43)
    expect(tracks()).toEqual([
      "JavaScript Foundations",
      "Practical Browser and Node.js",
      "TypeScript Essentials",
      "Testing, Debugging, and Code Quality",
      "Capstones",
    ])
  })

  test("has valid manifests and an acyclic prerequisite graph", () => {
    expect(validateCurriculum()).toEqual([])
  })

  test("provides starter, solution, hints, and deterministic checks", () => {
    const lesson = getLesson("js-01-values")
    expect(lesson?.files["index.js"]).toContain("TODO")
    expect(lesson?.solution["index.js"]).toContain("CodeTutor")
    expect(lesson?.hints).toHaveLength(3)
    expect(lesson?.check.command).toEqual(["bun", "test", "lesson.test.ts"])
  })

  test(
    "every starter fails and every bundled solution passes",
    async () => {
      for (const lesson of lessons) {
        const workspace = await mkdtemp(path.join(tmpdir(), `codetutor-${lesson.id}-`))
        workspaces.push(workspace)
        for (const [name, content] of Object.entries(lesson.files)) {
          await Bun.write(path.join(workspace, name), content)
        }
        const starter = Bun.spawnSync(lesson.check.command, { cwd: workspace, stdout: "pipe", stderr: "pipe" })
        expect(starter.exitCode, `${lesson.id} starter unexpectedly passed`).not.toBe(0)
        for (const [name, content] of Object.entries(lesson.solution)) {
          await Bun.write(path.join(workspace, name), content)
        }
        const solution = Bun.spawnSync(lesson.check.command, { cwd: workspace, stdout: "pipe", stderr: "pipe" })
        expect(
          solution.exitCode,
          `${lesson.id} solution failed:\n${solution.stdout.toString()}\n${solution.stderr.toString()}`,
        ).toBe(0)
      }
    },
    30_000,
  )
})
