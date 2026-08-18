export type LearnerLevel = "beginner" | "intermediate" | "advanced"
export type LessonStatus = "not_started" | "in_progress" | "completed"

export type LessonCheck = {
  command: string[]
  timeoutMs: number
}

export type Lesson = {
  id: string
  version: 1
  track: string
  order: number
  title: string
  concept: string
  level: LearnerLevel
  prerequisites: string[]
  objectives: string[]
  estimatedMinutes: number
  hints: [string, string, string]
  rubric: string[]
  mentorContext: string
  check: LessonCheck
  files: Record<string, string>
  solution: Record<string, string>
}

type Seed = {
  id: string
  track: string
  title: string
  concept: string
  level: LearnerLevel
  prompt: string
  expected: unknown
  solution: string
  ext?: "js" | "ts"
  prerequisites?: string[]
  minutes?: number
}

const seeds: Seed[] = [
  seed("js-01-values", "JavaScript Foundations", "Values and types", "primitive values", "beginner", "Return an array containing a string, number, boolean, null, and undefined in that order.", ["CodeTutor", 43, true, null, undefined], "return [\"CodeTutor\", 43, true, null, undefined]"),
  seed("js-02-variables", "JavaScript Foundations", "Variables", "const and let", "beginner", "Use variables to return the final score after adding 7 to an initial score of 35.", 42, "const score = 35\n  const bonus = 7\n  return score + bonus"),
  seed("js-03-conditionals", "JavaScript Foundations", "Conditionals", "branching", "beginner", "Return `pass` when the supplied score is at least 70 and `practice` otherwise. The test calls solve with 82.", "pass", "const score = 82\n  return score >= 70 ? \"pass\" : \"practice\""),
  seed("js-04-loops", "JavaScript Foundations", "Loops", "iteration", "beginner", "Return the sum of the numbers from 1 through 5 using a loop.", 15, "let total = 0\n  for (let value = 1; value <= 5; value += 1) total += value\n  return total"),
  seed("js-05-functions", "JavaScript Foundations", "Functions", "parameters and return values", "beginner", "Create a local multiply function and use it to return 6 × 7.", 42, "const multiply = (left, right) => left * right\n  return multiply(6, 7)"),
  seed("js-06-scope", "JavaScript Foundations", "Scope", "lexical scope", "beginner", "Use a closure that starts at 40 and returns 42 after adding 2.", 42, "const start = 40\n  const add = (value) => start + value\n  return add(2)"),
  seed("js-07-arrays", "JavaScript Foundations", "Arrays", "array access and updates", "beginner", "Start with [\"learn\", \"code\"] and return a new array with \"ship\" appended.", ["learn", "code", "ship"], "const steps = [\"learn\", \"code\"]\n  return [...steps, \"ship\"]"),
  seed("js-08-objects", "JavaScript Foundations", "Objects", "object properties", "beginner", "Return a learner object with name CodeTutor and level beginner.", { name: "CodeTutor", level: "beginner" }, "return { name: \"CodeTutor\", level: \"beginner\" }"),
  seed("js-09-array-methods", "JavaScript Foundations", "Array methods", "map and filter", "beginner", "From [1,2,3,4,5], keep even numbers and square them.", [4, 16], "return [1, 2, 3, 4, 5].filter((value) => value % 2 === 0).map((value) => value ** 2)"),
  seed("js-10-errors", "JavaScript Foundations", "Errors", "throwing and catching errors", "beginner", "Catch an Error with message `practice` and return its message.", "practice", "try {\n    throw new Error(\"practice\")\n  } catch (error) {\n    return error instanceof Error ? error.message : \"unknown\"\n  }"),
  seed("js-11-modules", "JavaScript Foundations", "Modules", "module boundaries", "beginner", "Return an object exposing a reusable add result and a descriptive label.", { label: "module", result: 42 }, "const add = (left, right) => left + right\n  return { label: \"module\", result: add(20, 22) }"),
  seed("js-12-promises", "JavaScript Foundations", "Promises", "asynchronous values", "intermediate", "Return a Promise that resolves to `ready`.", "ready", "return Promise.resolve(\"ready\")"),

  seed("web-01-dom-data", "Practical Browser and Node.js", "Representing UI", "data-driven UI", "beginner", "Represent a heading as {tag,text} using h1 and Learn JavaScript.", { tag: "h1", text: "Learn JavaScript" }, "return { tag: \"h1\", text: \"Learn JavaScript\" }"),
  seed("web-02-events", "Practical Browser and Node.js", "Events", "event-driven updates", "beginner", "Model three click events and return the final count.", 3, "const events = [\"click\", \"click\", \"click\"]\n  return events.reduce((count) => count + 1, 0)"),
  seed("web-03-forms", "Practical Browser and Node.js", "Forms", "normalizing input", "beginner", "Trim and lowercase the simulated email `  LEARN@EXAMPLE.COM `.", "learn@example.com", "return \"  LEARN@EXAMPLE.COM \".trim().toLowerCase()"),
  seed("web-04-state", "Practical Browser and Node.js", "State", "immutable state", "intermediate", "Add complete:true to the todo without mutating the original object.", { title: "lesson", complete: true }, "const todo = { title: \"lesson\", complete: false }\n  return { ...todo, complete: true }"),
  seed("web-05-fetch", "Practical Browser and Node.js", "HTTP and JSON", "response parsing", "intermediate", "Parse the supplied JSON string and return its lessons count.", 43, "const response = JSON.parse('{\"lessons\":43}')\n  return response.lessons"),
  seed("node-01-files", "Practical Browser and Node.js", "File data", "reading structured files", "intermediate", "Parse three newline-separated lesson names and return the non-empty names.", ["values", "functions", "objects"], "return \"values\\nfunctions\\nobjects\\n\".trim().split(\"\\n\")"),
  seed("node-02-paths", "Practical Browser and Node.js", "Paths", "portable path segments", "intermediate", "Return the portable segments for lessons/javascript/index.js.", ["lessons", "javascript", "index.js"], "return \"lessons/javascript/index.js\".split(\"/\")"),
  seed("node-03-cli-args", "Practical Browser and Node.js", "CLI arguments", "command parsing", "intermediate", "Parse [learn,start,js-01-values] into command, action, and lesson.", { command: "learn", action: "start", lesson: "js-01-values" }, "const [command, action, lesson] = [\"learn\", \"start\", \"js-01-values\"]\n  return { command, action, lesson }"),
  seed("node-04-packages", "Practical Browser and Node.js", "Packages", "package metadata", "intermediate", "Return minimal package metadata for a private ESM package named lesson-project.", { name: "lesson-project", private: true, type: "module" }, "return { name: \"lesson-project\", private: true, type: \"module\" }"),
  seed("node-05-mini-cli", "Practical Browser and Node.js", "Mini CLI", "command dispatch", "intermediate", "Dispatch the command status to the message `3 lessons complete`.", "3 lessons complete", "const commands = { status: () => \"3 lessons complete\" }\n  return commands.status()"),

  seed("ts-01-annotations", "TypeScript Essentials", "Type annotations", "explicit types", "beginner", "Return the numeric answer 42 from a typed constant.", 42, "const answer: number = 42\n  return answer", "ts"),
  seed("ts-02-unions", "TypeScript Essentials", "Union types", "finite choices", "beginner", "Use a beginner|intermediate|advanced union and return intermediate.", "intermediate", "type Level = \"beginner\" | \"intermediate\" | \"advanced\"\n  const level: Level = \"intermediate\"\n  return level", "ts"),
  seed("ts-03-narrowing", "TypeScript Essentials", "Narrowing", "safe runtime checks", "intermediate", "Narrow the unknown value CodeTutor and return its length.", 9, "const value: unknown = \"CodeTutor\"\n  return typeof value === \"string\" ? value.length : 0", "ts"),
  seed("ts-04-interfaces", "TypeScript Essentials", "Interfaces", "object contracts", "intermediate", "Define a Learner interface and return Ada at the advanced level.", { name: "Ada", level: "advanced" }, "interface Learner { name: string; level: \"beginner\" | \"intermediate\" | \"advanced\" }\n  const learner: Learner = { name: \"Ada\", level: \"advanced\" }\n  return learner", "ts"),
  seed("ts-05-functions", "TypeScript Essentials", "Typed functions", "function contracts", "intermediate", "Write a typed add function and return 42.", 42, "const add = (left: number, right: number): number => left + right\n  return add(19, 23)", "ts"),
  seed("ts-06-generics", "TypeScript Essentials", "Generics", "reusable types", "intermediate", "Write a generic first function and return the first lesson ID.", "ts-01-annotations", "const first = <T>(items: T[]): T | undefined => items[0]\n  return first([\"ts-01-annotations\", \"ts-02-unions\"])", "ts"),
  seed("ts-07-utilities", "TypeScript Essentials", "Utility types", "derived object types", "intermediate", "Use Pick to create a public learner containing only name and level.", { name: "Lin", level: "intermediate" }, "type Learner = { name: string; level: string; secret: string }\n  const learner: Pick<Learner, \"name\" | \"level\"> = { name: \"Lin\", level: \"intermediate\" }\n  return learner", "ts"),
  seed("ts-08-modules", "TypeScript Essentials", "Typed modules", "exported contracts", "intermediate", "Return a typed module descriptor with one export named solve.", { module: "lesson", exports: ["solve"] }, "type Descriptor = { module: string; exports: string[] }\n  return { module: \"lesson\", exports: [\"solve\"] } satisfies Descriptor", "ts"),
  seed("ts-09-validation", "TypeScript Essentials", "Runtime validation", "validating external data", "advanced", "Validate that an unknown object has a string title and return it, otherwise invalid.", "CodeTutor", "const input: unknown = { title: \"CodeTutor\" }\n  if (typeof input !== \"object\" || input === null || !(\"title\" in input) || typeof input.title !== \"string\") return \"invalid\"\n  return input.title", "ts"),
  seed("ts-10-migration", "TypeScript Essentials", "JavaScript migration", "incremental typing", "advanced", "Model a typed migration result with two fixed files and zero errors.", { files: 2, errors: 0 }, "type Migration = { files: number; errors: number }\n  const result: Migration = { files: 2, errors: 0 }\n  return result", "ts"),

  seed("quality-01-tests", "Testing, Debugging, and Code Quality", "Assertions", "test expectations", "beginner", "Return the expected and actual values for a passing addition check.", { expected: 4, actual: 4, pass: true }, "const expected = 4\n  const actual = 2 + 2\n  return { expected, actual, pass: expected === actual }"),
  seed("quality-02-table-tests", "Testing, Debugging, and Code Quality", "Table tests", "data-driven tests", "intermediate", "Evaluate [1,2], [2,4], [3,6] against doubling and return whether all pass.", true, "const cases = [[1, 2], [2, 4], [3, 6]]\n  return cases.every(([input, expected]) => input * 2 === expected)"),
  seed("quality-03-debugging", "Testing, Debugging, and Code Quality", "Debugging", "isolating faulty state", "intermediate", "Find and return the first failed pipeline stage.", "transform", "const stages = [{ name: \"read\", ok: true }, { name: \"transform\", ok: false }, { name: \"write\", ok: false }]\n  return stages.find((stage) => !stage.ok)?.name"),
  seed("quality-04-errors", "Testing, Debugging, and Code Quality", "Actionable errors", "error context", "intermediate", "Return an error payload with code LESSON_NOT_FOUND and lesson missing-id.", { code: "LESSON_NOT_FOUND", lesson: "missing-id" }, "return { code: \"LESSON_NOT_FOUND\", lesson: \"missing-id\" }"),
  seed("quality-05-refactor", "Testing, Debugging, and Code Quality", "Refactoring", "removing duplication", "intermediate", "Use one reusable normalize function to return two lowercase trimmed names.", ["ada", "grace"], "const normalize = (value) => value.trim().toLowerCase()\n  return [\" Ada \", \" GRACE\"].map(normalize)"),
  seed("quality-06-pure-functions", "Testing, Debugging, and Code Quality", "Pure functions", "predictable transformations", "intermediate", "Return a new completed todo while leaving the original unchanged.", { original: false, next: true }, "const original = { complete: false }\n  const next = { ...original, complete: true }\n  return { original: original.complete, next: next.complete }"),
  seed("quality-07-dependency-boundaries", "Testing, Debugging, and Code Quality", "Dependency boundaries", "dependency direction", "advanced", "Return whether UI→Core→Schema is a valid one-way dependency chain.", true, "const edges = [[\"ui\", \"core\"], [\"core\", \"schema\"]]\n  return edges.every(([from, to]) => from !== to)"),
  seed("quality-08-integration", "Testing, Debugging, and Code Quality", "Integration checks", "end-to-end behavior", "advanced", "Model a successful scaffold, check, and completion flow.", { scaffolded: true, checked: true, status: "completed" }, "return { scaffolded: true, checked: true, status: \"completed\" }"),

  seed("capstone-01-habit-cli", "Capstones", "Habit tracker CLI", "command-oriented application design", "intermediate", "Return a habit tracker summary after completing one of two habits.", { total: 2, completed: 1, remaining: 1 }, "const habits = [{ complete: true }, { complete: false }]\n  const completed = habits.filter((habit) => habit.complete).length\n  return { total: habits.length, completed, remaining: habits.length - completed }", "ts", ["node-05-mini-cli", "quality-02-table-tests"], 90),
  seed("capstone-02-api-dashboard", "Capstones", "API learning dashboard", "asynchronous data presentation", "advanced", "Turn lesson API data into a dashboard summary.", { tracks: 5, lessons: 43, completion: "25%" }, "const data = { tracks: 5, lessons: 43, completed: 11 }\n  return { tracks: data.tracks, lessons: data.lessons, completion: `${Math.floor((data.completed / data.lessons) * 100)}%` }", "ts", ["web-05-fetch", "ts-09-validation"], 120),
  seed("capstone-03-typed-library", "Capstones", "Typed curriculum library", "public API design", "advanced", "Return a stable public-library descriptor for a curriculum package.", { name: "curriculum", version: 1, exports: ["lessons", "getLesson"] }, "return { name: \"curriculum\", version: 1, exports: [\"lessons\", \"getLesson\"] }", "ts", ["ts-10-migration", "quality-07-dependency-boundaries"], 120),
]

function seed(
  id: string,
  track: string,
  title: string,
  concept: string,
  level: LearnerLevel,
  prompt: string,
  expected: unknown,
  solution: string,
  ext: "js" | "ts" = "js",
  prerequisites?: string[],
  minutes?: number,
): Seed {
  return { id, track, title, concept, level, prompt, expected, solution, ext, prerequisites, minutes }
}

function inferredPrerequisites(seed: Seed, index: number) {
  if (seed.prerequisites) return seed.prerequisites
  const previous = seeds[index - 1]
  if (!previous || previous.track !== seed.track) return []
  return [previous.id]
}

function project(seed: Seed, index: number): Lesson {
  const ext = seed.ext ?? "js"
  const file = `index.${ext}`
  const readme = `# ${seed.title}\n\n${seed.prompt}\n\nRun \`bun test\` or \`codetutor learn check\` when you are ready.\n`
  const test = `import { expect, test } from "bun:test"\nimport { solve } from "./${file}"\n\ntest(${JSON.stringify(seed.title)}, async () => {\n  expect(await Promise.resolve(solve())).toEqual(${serialize(seed.expected)})\n})\n`
  const packageJson = JSON.stringify(
    { name: `codetutor-${seed.id}`, private: true, type: "module", scripts: { test: "bun test lesson.test.ts" } },
    null,
    2,
  )
  return {
    id: seed.id,
    version: 1,
    track: seed.track,
    order: index + 1,
    title: seed.title,
    concept: seed.concept,
    level: seed.level,
    prerequisites: inferredPrerequisites(seed, index),
    objectives: [`Explain ${seed.concept}.`, `Apply ${seed.concept} in a small program.`, "Verify behavior with an automated check."],
    estimatedMinutes: seed.minutes ?? (seed.level === "beginner" ? 20 : seed.level === "intermediate" ? 35 : 50),
    hints: [
      `Restate the task in terms of ${seed.concept} before changing code.`,
      `Inspect the expected value in lesson.test.ts and identify the smallest ${seed.concept} operation that produces it.`,
      `Keep solve() focused on one result; the completed body is structurally similar to: ${seed.solution.split("\n")[0]}.`,
    ],
    rubric: ["The bundled check passes.", `The solution demonstrates ${seed.concept}.`, "The code remains readable and focused."],
    mentorContext: `Teach ${seed.concept} through prediction, a small experiment, and reflection. Do not reveal the final implementation before the learner asks for the solution.`,
    check: { command: ["bun", "test", "lesson.test.ts"], timeoutMs: 15_000 },
    files: {
      "README.md": readme,
      "package.json": packageJson + "\n",
      [file]: `export function solve() {\n  throw new Error("TODO: ${seed.prompt.replaceAll('"', "'")}")\n}\n`,
      "lesson.test.ts": test,
    },
    solution: {
      [file]: `export function solve() {\n  ${seed.solution.replaceAll("\n", "\n  ")}\n}\n`,
    },
  }
}

function serialize(value: unknown): string {
  if (value === undefined) return "undefined"
  if (Array.isArray(value)) return `[${value.map(serialize).join(", ")}]`
  return JSON.stringify(value)
}

export const lessons = seeds.map(project)

export function getLesson(id: string) {
  return lessons.find((lesson) => lesson.id === id)
}

export function tracks() {
  return Array.from(new Set(lessons.map((lesson) => lesson.track)))
}

export function validateCurriculum(input: Lesson[] = lessons) {
  const ids = new Set<string>()
  const errors: string[] = []
  for (const lesson of input) {
    if (ids.has(lesson.id)) errors.push(`Duplicate lesson ID: ${lesson.id}`)
    ids.add(lesson.id)
    if (lesson.hints.length !== 3) errors.push(`${lesson.id} must provide exactly three hints`)
    if (!lesson.files["README.md"] || !lesson.files["package.json"]) errors.push(`${lesson.id} is missing project files`)
    if (lesson.check.command.length === 0 || lesson.check.timeoutMs <= 0) errors.push(`${lesson.id} has an invalid check`)
  }
  for (const lesson of input) {
    for (const prerequisite of lesson.prerequisites) {
      if (!ids.has(prerequisite)) errors.push(`${lesson.id} references missing prerequisite ${prerequisite}`)
    }
  }
  const visit = (id: string, path: Set<string>) => {
    if (path.has(id)) {
      errors.push(`Prerequisite cycle includes ${id}`)
      return
    }
    const lesson = input.find((item) => item.id === id)
    if (!lesson) return
    const next = new Set(path).add(id)
    lesson.prerequisites.forEach((prerequisite) => visit(prerequisite, next))
  }
  input.forEach((lesson) => visit(lesson.id, new Set()))
  return errors
}
