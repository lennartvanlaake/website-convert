import util from "node:util";
import child_process from "node:child_process";
const exec = util.promisify(child_process.exec);

function sandboxTemplate(sandboxDir: string) {
  return `
/usr/bin/bwrap \
    --tmpfs /tmp \
    --dev /dev \
    --proc /proc \
    --proc /proc \
    --hostname bubblewrap \
    --unshare-uts \
    --ro-bind ${sandboxDir} ${sandboxDir} \
    --ro-bind /lib64 /lib64 \
    --ro-bind /lib /lib \
    --ro-bind /usr/lib /usr/lib \
    --ro-bind /usr/local/lib /usr/local/lib \
    --ro-bind /usr/bin /usr/bin \
    --ro-bind /usr/sbin /usr/sbin \
    --ro-bind /bin /bin \
    --ro-bind /sbin /sbin \
    --chdir ${sandboxDir} \
`;
}

export async function sandboxCommand(sandboxDir: string, command: string) {
  // ponytail: collapse to a single line so node's sh -c doesn't split the
  // bwrap options across argv entries (multiline keeps "--chdir /path exit 3"
  // as separate tokens, which execvp can't resolve).
  const singleLine = command.split(/\s+/).filter(Boolean).join(" ");
  const cmd = `${sandboxTemplate(sandboxDir.trim()).trim()} ${singleLine}`;
  try {
    const result = await exec(cmd);
    return `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
  } catch (e: any) {
    // ponytail: intentional non-zero exits ("exit 3", read-only writes) must
    // surface their output, not throw, so callers can assert on it.
    return `exit code ${e.code ?? 1}\n${e.stdout ?? ""}\n${e.stderr ?? ""}`;
  }
}
