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
  const result = await exec(`${sandboxTemplate(sandboxDir.trim())} ${command}`);
  return `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}

const result = await sandboxCommand("/home/lennart", "ls");
console.log(result);
