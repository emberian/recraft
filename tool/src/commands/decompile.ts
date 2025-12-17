import { resolve, basename } from "path";
import { $ } from "bun";
import { extractJar } from "../lib/jar";
import { decompileClasses } from "../lib/vineflower";
import { writeProjectJson, type ProjectMetadata } from "../lib/project";
import { hashFile } from "../lib/hash";

export async function decompile(jarPath: string, projectName?: string) {
  const resolvedJar = resolve(jarPath);
  const name = projectName ?? basename(jarPath, ".jar");

  // Project directory is sibling to tool/
  const toolDir = resolve(import.meta.dir, "../..");
  const projectDir = resolve(toolDir, "..", name);

  console.log(`Decompiling ${resolvedJar} to ${projectDir}`);

  // Check if project already exists
  const projectExists = await Bun.file(resolve(projectDir, "project.json")).exists();
  if (projectExists) {
    console.error(`Project ${name} already exists. Use 'mcmod update' to update it.`);
    process.exit(1);
  }

  // Create project structure
  await Bun.write(resolve(projectDir, ".gitkeep"), "");
  await $`mkdir -p ${projectDir}/src ${projectDir}/resources ${projectDir}/libs`;

  // Extract JAR to temp directory
  const tempDir = resolve(projectDir, ".temp");
  await $`mkdir -p ${tempDir}`;

  console.log("Extracting JAR...");
  await extractJar(resolvedJar, tempDir);

  // Decompile classes
  console.log("Decompiling classes with Vineflower...");
  await decompileClasses(tempDir, resolve(projectDir, "src"));

  // Copy resources (non-class files)
  console.log("Copying resources...");
  await copyResources(tempDir, resolve(projectDir, "resources"));

  // Calculate JAR hash and write project.json
  const jarHash = await hashFile(resolvedJar);
  const metadata: ProjectMetadata = {
    name,
    sourceJar: resolvedJar,
    sourceJarHash: jarHash,
    decompileDate: new Date().toISOString(),
    vineflowerVersion: "1.11.2",
  };
  await writeProjectJson(projectDir, metadata);

  // Cleanup temp
  await $`rm -rf ${tempDir}`;

  console.log(`\nProject ${name} created successfully!`);
  console.log(`  Source: ${projectDir}/src`);
  console.log(`  Resources: ${projectDir}/resources`);
}

async function copyResources(extractedDir: string, resourcesDir: string) {
  // Find all non-class files and copy them (including dotfiles like .mcassetsroot)
  const glob = new Bun.Glob("**/*");

  for await (const file of glob.scan({ cwd: extractedDir, onlyFiles: true, dot: true })) {
    if (file.endsWith(".class")) continue;

    const srcPath = resolve(extractedDir, file);
    const destPath = resolve(resourcesDir, file);

    // Create parent directory
    const destDir = resolve(destPath, "..");
    await $`mkdir -p ${destDir}`;

    // Copy file
    await $`cp ${srcPath} ${destPath}`;
  }
}
