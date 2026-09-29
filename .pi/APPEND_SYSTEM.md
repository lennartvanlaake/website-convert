# AGENTS.md

Use **bun**, so tests are run with **bun test**. Package.json is in root dir `/home/lennart/repos/ai-fiddling/website_convert`. It uses  built on **AI-SDK (Vercel)**.

Working rules:

- **Be terse.** Short commands, minimal diffs, terse explanations.
- **Write tests** — We want high coverage of all production code. When debugging, edit reusable tests instead of creating one-off files to check a hypothesis.
- **Use the internet** - Search for answers online if a problem is difficult.
- **Use tsc to check code** - We want our code to have no tsc, be typed properly and production-ready
- Keep changes small and focused; prefer the shortest working diff.
- Use the ponytail skill for code
- Do not do anything you were not asked to do. If you see problems in files you work in, ask for permission to fix.
- Use explicit input types, avoid explicit output types (so `function() { return "hello world" }` instead of `function(): String => { return "hello world" }`:w*n 

