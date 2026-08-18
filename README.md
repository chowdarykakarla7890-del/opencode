<p align="center">
  <picture>
    <source srcset="packages/web/src/assets/logo-dark.svg" media="(prefers-color-scheme: dark)">
    <source srcset="packages/web/src/assets/logo-light.svg" media="(prefers-color-scheme: light)">
    <img src="packages/web/src/assets/logo-light.svg" alt="CodeTutor" width="250">
  </picture>
</p>

<p align="center"><strong>Learn to code inside real projects, from your terminal.</strong></p>

CodeTutor is an open-source AI coding tutor for beginner, intermediate, and advanced learners. It combines a project-aware terminal tutor with a 43-lesson JavaScript and TypeScript curriculum, deterministic exercise checks, a browser app, a desktop app, and a TypeScript SDK.

## Install

```bash
npm install -g codetutor
codetutor
```

The first launch asks for your teaching level. CodeTutor adapts its guidance while keeping you in control: beginners receive questions and layered hints, intermediate learners get collaborative scaffolding, and advanced learners get concise review and tradeoff analysis.

No model is required to browse lessons, create workspaces, run checks, or inspect progress. Connect a supported provider only when you want an interactive AI tutoring session.

## Learn

```bash
codetutor learn                         # curriculum overview
codetutor learn list --level beginner   # browse lessons
codetutor learn start js-01-values      # start or resume
codetutor learn hint                    # next layered hint
codetutor learn check                   # deterministic validation
codetutor learn status                  # local progress
codetutor learn solution                # show a diff; never overwrite work
codetutor learn reset js-01-values --force
codetutor learn level intermediate
```

The bundled curriculum contains:

- 12 JavaScript Foundations lessons
- 10 Practical Browser and Node.js lessons
- 10 TypeScript Essentials lessons
- 8 Testing, Debugging, and Code Quality lessons
- 3 capstone projects

Lesson workspaces and progress are stored locally in the platform-specific CodeTutor data directory. A lesson is complete only when its bundled validator passes.

Inside a tutoring session, use `/lesson`, `/hint`, `/check`, `/progress`, and `/solution`.

## Apps and SDK

- `codetutor web` opens the embedded local browser experience.
- The hosted [browser app](https://codetutor-app-red.vercel.app) uses a local CodeTutor server at `http://localhost:4096` by default. Approve the browser's local-network permission prompt when asked.
- The [CodeTutor documentation](https://codetutor-docs.vercel.app) is deployed separately as a static Astro site.
- Unsigned desktop beta builds for macOS, Windows, and Linux are published on [GitHub Releases](https://github.com/chowdarykakarla7890-del/opencode/releases). Your operating system may require manual Gatekeeper or SmartScreen approval until signing credentials are available.
- `codetutor-sdk` exports `createCodeTutorClient`, `createCodeTutorServer`, `createCodeTutor`, and `CodeTutorClient`.
- `codetutor-plugin` is the public plugin package.

## Development

This monorepo uses Bun 1.3.14.

```bash
bun install
bun run --cwd packages/opencode typecheck
bun run --cwd packages/curriculum test
bun run --cwd packages/app build
bun run --cwd packages/web build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance and [NOTICE](NOTICE) for upstream attribution.

## License and attribution

CodeTutor is released under the MIT License. It is a fork of OpenCode and retains the upstream copyright notice. CodeTutor is an independent project and is not affiliated with or endorsed by the upstream project. OpenCode Zen remains available only as a clearly labeled third-party model provider.
