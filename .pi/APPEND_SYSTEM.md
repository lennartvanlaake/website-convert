# AGENTS.md

Use **bun**, so tests are run with **bun test**. Package.json is in root dir `/home/lennart/repos/ai-fiddling/website_convert`. It uses  built on **AI-SDK (Vercel)**.

Working rules:

- **Be terse.** Short commands, minimal diffs, terse explanations.
- **Work incrementally** - Keep edits as small as possible. If asked to write a test that is > 5 lines, write a part of the test, run it, then add more code. If asked to write 2 functions, write 1 function, test it, then write the second one. 
- **Use the internet** - Search for answers online if a problem is difficult.
- **Use tsc to check code** - We want our code to have no tsc, be typed properly and production-ready
- Use the ponytail skill for code
- Do not do anything you were not asked to do. If you see problems in files you work in, ask for permission to fix.
- Use explicit input types, avoid explicit output types (so `function() { return "hello world" }` instead of `function(): String => { return "hello world" }`:w*n 

