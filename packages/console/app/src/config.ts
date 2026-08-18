/**
 * Application-wide constants and configuration
 */
export const config = {
  // Base URL
  baseUrl: "https://codetutor-docs.vercel.app",

  // GitHub
  github: {
    repoUrl: "https://github.com/chowdarykakarla7890-del/opencode",
    starsFormatted: {
      compact: "195K",
      full: "195,000",
    },
  },

  // Social links
  social: {
    twitter: "https://x.com/opencode",
    discord: "https://discord.gg/opencode",
  },

  // Static stats (used on landing page)
  stats: {
    contributors: "950",
    commits: "13,000",
    monthlyUsers: "16M",
  },
} as const
