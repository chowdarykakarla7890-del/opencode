import { expect, test } from "bun:test"
import path from "node:path"
import { tmpdir } from "../fixture/fixture"

test("the offline learning service completes the local lesson lifecycle", async () => {
  await using tmp = await tmpdir()
  const program = String.raw`
    const { AppRuntime } = await import("./src/effect/app-runtime.ts")
    const { Learning } = await import("./src/learning/learning.ts")
    const { getLesson } = await import("@codetutor/curriculum")
    const path = await import("node:path")
    const lesson = getLesson("js-01-values")
    await AppRuntime.runPromise(Learning.setLevel("beginner"))
    const first = await AppRuntime.runPromise(Learning.start(lesson.id))
    const second = await AppRuntime.runPromise(Learning.start(lesson.id))
    const file = Object.keys(lesson.solution)[0]
    const learner = await Bun.file(path.join(first.workspace, file)).text()
    const failed = await AppRuntime.runPromise(Learning.check())
    const hints = [
      await AppRuntime.runPromise(Learning.hint()),
      await AppRuntime.runPromise(Learning.hint()),
      await AppRuntime.runPromise(Learning.hint()),
      await AppRuntime.runPromise(Learning.hint()),
    ]
    const reveal = await AppRuntime.runPromise(Learning.revealSolution())
    const unchanged = await Bun.file(path.join(first.workspace, file)).text()
    for (const [name, content] of Object.entries(lesson.solution)) {
      await Bun.write(path.join(first.workspace, name), content)
    }
    const passed = await AppRuntime.runPromise(Learning.check())
    const catalog = await AppRuntime.runPromise(Learning.catalog())
    await AppRuntime.runPromise(Learning.reset(lesson.id))
    const reset = await Bun.file(path.join(first.workspace, file)).text()
    await AppRuntime.dispose()
    console.log(JSON.stringify({
      level: "beginner",
      first: first.resumed,
      second: second.resumed,
      failed: failed.passed,
      hints: hints.map((hint) => hint.exhausted),
      diff: reveal.diffs[file],
      unchanged: learner === unchanged,
      passed: passed.passed,
      completed: catalog.filter((item) => item.progress.status === "completed").length,
      reset: reset === lesson.files[file],
    }))
  `
  const proc = Bun.spawn([process.execPath, "--conditions=browser", "-e", program], {
    cwd: path.resolve(import.meta.dir, "../.."),
    env: {
      ...process.env,
      XDG_DATA_HOME: path.join(tmp.path, "data"),
      XDG_CONFIG_HOME: path.join(tmp.path, "config"),
      XDG_CACHE_HOME: path.join(tmp.path, "cache"),
      XDG_STATE_HOME: path.join(tmp.path, "state"),
      NO_COLOR: "1",
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (exitCode !== 0) throw new Error(stderr)
  const result = JSON.parse(stdout.trim())
  expect(result).toMatchObject({
    level: "beginner",
    first: false,
    second: true,
    failed: false,
    hints: [false, false, false, true],
    unchanged: true,
    passed: true,
    completed: 1,
    reset: true,
  })
  expect(result.diff).toContain("--- learner/")
}, 30_000)

test("a non-interactive first launch safely selects beginner", async () => {
  await using tmp = await tmpdir()
  const proc = Bun.spawn([process.execPath, "run", "--conditions=browser", "src/index.ts", "--no-replay"], {
    cwd: path.resolve(import.meta.dir, "../.."),
    env: {
      ...process.env,
      XDG_DATA_HOME: path.join(tmp.path, "data"),
      XDG_CONFIG_HOME: path.join(tmp.path, "config"),
      XDG_CACHE_HOME: path.join(tmp.path, "cache"),
      XDG_STATE_HOME: path.join(tmp.path, "state"),
      NO_COLOR: "1",
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  expect(exitCode).toBe(1)
  expect(stdout + stderr).toContain("selected the beginner teaching level")
}, 30_000)
