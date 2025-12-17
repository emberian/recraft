import { $ } from "bun";

const VINEFLOWER_PATH = "/opt/homebrew/bin/vineflower";

export async function decompileClasses(
  inputDir: string,
  outputDir: string
): Promise<void> {
  // Vineflower decompiles all .class files in the input directory
  // and outputs .java files to the output directory preserving package structure
  const proc = Bun.spawn([VINEFLOWER_PATH, "--folder", inputDir, outputDir], {
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Vineflower exited with code ${exitCode}`);
  }
}

export async function decompileJar(
  jarPath: string,
  outputDir: string
): Promise<void> {
  // Vineflower can also decompile directly from a JAR
  const proc = Bun.spawn([VINEFLOWER_PATH, "--folder", jarPath, outputDir], {
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Vineflower exited with code ${exitCode}`);
  }
}
