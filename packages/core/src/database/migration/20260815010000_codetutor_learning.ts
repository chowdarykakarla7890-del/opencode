import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260815010000_codetutor_learning",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`learning_profile\` (
          \`id\` integer PRIMARY KEY,
          \`level\` text NOT NULL,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`lesson_progress\` (
          \`lesson_id\` text PRIMARY KEY,
          \`status\` text NOT NULL,
          \`workspace\` text NOT NULL,
          \`attempts\` integer DEFAULT 0 NOT NULL,
          \`hint_index\` integer DEFAULT 0 NOT NULL,
          \`solution_revealed\` integer DEFAULT 0 NOT NULL,
          \`time_started\` integer NOT NULL,
          \`time_completed\` integer,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL
        );
      `)
    })
  },
} satisfies DatabaseMigration.Migration
