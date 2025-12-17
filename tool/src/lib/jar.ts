import { $ } from "bun";
import { resolve } from "path";

export async function extractJar(jarPath: string, destDir: string): Promise<void> {
  await $`unzip -q -o ${jarPath} -d ${destDir}`;
}

export async function createJar(
  sourceDir: string,
  outputJar: string,
  manifestPath?: string
): Promise<void> {
  // Remove signature files before creating JAR (they invalidate after modification)
  const metaInf = resolve(sourceDir, "META-INF");
  try {
    const sigGlob = new Bun.Glob("*.{SF,RSA,DSA,EC}");
    for await (const file of sigGlob.scan({ cwd: metaInf, onlyFiles: true })) {
      await $`rm -f ${resolve(metaInf, file)}`.quiet().nothrow();
    }
  } catch {
    // META-INF might not exist yet
  }

  const args = ["jar"];

  if (manifestPath) {
    args.push("cfm", outputJar, manifestPath);
  } else {
    args.push("cf", outputJar);
  }

  args.push("-C", sourceDir, ".");

  const proc = Bun.spawn(args, {
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`jar command exited with code ${exitCode}`);
  }
}

export async function readManifest(jarPath: string): Promise<string | null> {
  try {
    const result = await $`unzip -p ${jarPath} META-INF/MANIFEST.MF`.text();
    return result;
  } catch {
    return null;
  }
}
