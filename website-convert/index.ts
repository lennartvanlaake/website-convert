import { z } from "zod";
import { init } from "./init.ts";

const MainState = z.object({
  url: z.string(),
  project: z.string(),
  originDir: z.string().default(""),
  targetDir: z.string().default(""),
});

export async function run(state: z.infer<typeof MainState>) {
  await init({
    url: state.url,
    project: state.project,
    originDir: state.originDir,
    targetDir: state.targetDir,
  });
}
