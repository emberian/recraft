import { $ } from "bun";
import { resolve } from "path";

export interface CompileOptions {
  sourceDir: string;
  outputDir: string;
  classpath?: string[];
  sourceVersion?: string;
  targetVersion?: string;
  excludeFiles?: Set<string>;
}

export async function compileJava(options: CompileOptions): Promise<void> {
  const { sourceDir, outputDir, classpath = [], sourceVersion = "25", targetVersion = "25", excludeFiles = new Set() } = options;

  // Find all .java files
  const glob = new Bun.Glob("**/*.java");
  const javaFiles: string[] = [];
  let excluded = 0;

  for await (const file of glob.scan({ cwd: sourceDir, onlyFiles: true })) {
    if (excludeFiles.has(file)) {
      excluded++;
      continue;
    }
    javaFiles.push(resolve(sourceDir, file));
  }

  if (excluded > 0) {
    console.log(`Excluded ${excluded} files from compilation`);
  }

  if (javaFiles.length === 0) {
    throw new Error("No .java files found to compile");
  }

  console.log(`Compiling ${javaFiles.length} Java files...`);

  // Build javac command
  const args = [
    "javac",
    "-source", sourceVersion,
    "-target", targetVersion,
    "--enable-preview",
    "-d", outputDir,
  ];

  // Add classpath if provided
  if (classpath.length > 0) {
    args.push("-cp", classpath.join(":"));
  }

  // Write file list to a temporary file (javac @file syntax for many files)
  const fileListPath = resolve(outputDir, ".javac-files");
  await Bun.write(fileListPath, javaFiles.join("\n"));

  args.push(`@${fileListPath}`);

  // Ensure output directory exists
  await $`mkdir -p ${outputDir}`;

  // Run javac
  const proc = Bun.spawn(args, {
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;

  // Cleanup file list
  await $`rm -f ${fileListPath}`;

  if (exitCode !== 0) {
    throw new Error(`javac exited with code ${exitCode}`);
  }
}

export async function findLibraries(libsDir: string): Promise<string[]> {
  const glob = new Bun.Glob("**/*.jar");
  const jars: string[] = [];

  try {
    for await (const file of glob.scan({ cwd: libsDir, onlyFiles: true })) {
      jars.push(resolve(libsDir, file));
    }
  } catch {
    // libs directory may not exist
  }

  return jars;
}
