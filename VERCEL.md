# CodeTutor on Vercel

Create two Vercel projects from this repository. Set the production branch to `dev` for both projects.

| Project | Root directory | Framework | Production domain |
| --- | --- | --- | --- |
| `codetutor-docs` | `packages/web` | Astro | `codetutor-docs.vercel.app` |
| `codetutor-app` | `packages/app` | Vite | `codetutor-app-red.vercel.app` |

Set `VITE_DEFAULT_SERVER_URL=http://localhost:4096` in the browser app project for Production, Preview, and Development. Preview origins are intentionally not accepted by the local server unless the learner starts it with an explicit `--cors https://<preview-host>` value.

Current Chromium releases ask the learner to allow local network access before a public HTTPS app can reach the loopback CodeTutor server. The learner must approve that browser prompt; CodeTutor still validates the exact production origin with CORS.

The browser app is static and uses SPA rewrites. The documentation project is static Astro. `codetutor web` continues to serve the embedded same-origin app and does not depend on Vercel.

The shorter `codetutor-app.vercel.app` alias is owned by another Vercel account, so this project uses Vercel's generated `codetutor-app-red.vercel.app` production alias.
