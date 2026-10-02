import { $ } from "bun";

export async function getTree(dir: string) {
  const json =
    await $`lstr ${dir} --output json --max-items 50 -s --sort size`.text();
  return JSON.parse(json.trim());
}
