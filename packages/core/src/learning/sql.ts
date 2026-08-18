import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../database/schema.sql"

export const LearningProfileTable = sqliteTable("learning_profile", {
  id: integer().primaryKey(),
  level: text().$type<"beginner" | "intermediate" | "advanced">().notNull(),
  ...Timestamps,
})

export const LessonProgressTable = sqliteTable("lesson_progress", {
  lesson_id: text().primaryKey(),
  status: text().$type<"in_progress" | "completed">().notNull(),
  workspace: text().notNull(),
  attempts: integer().notNull().default(0),
  hint_index: integer().notNull().default(0),
  solution_revealed: integer({ mode: "boolean" }).notNull().default(false),
  time_started: integer().notNull(),
  time_completed: integer(),
  ...Timestamps,
})
