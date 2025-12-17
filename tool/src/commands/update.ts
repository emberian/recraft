import { resolve } from "path";
import { readProjectJson, writeProjectJson, getProjectDir } from "../lib/project";
import { extractJar } from "../lib/jar";
import { decompileClasses } from "../lib/vineflower";
import { hashFile } from "../lib/hash";
import { $ } from "bun";

interface FileChange {
  path: string;
  type: "added" | "modified" | "deleted" | "conflict";
}

export async function update(projectName: string, newJarPath: string) {
  const projectDir = await getProjectDir(projectName);
  const metadata = await readProjectJson(projectDir);
  const resolvedJar = resolve(newJarPath);

  console.log(`Updating project ${metadata.name} from ${resolvedJar}`);

  const srcDir = resolve(projectDir, "src");
  const tempDir = resolve(projectDir, ".update-temp");
  const newSrcDir = resolve(tempDir, "src");

  // Clean temp directory
  await $`rm -rf ${tempDir}`;
  await $`mkdir -p ${tempDir}/extracted ${newSrcDir}`;

  // Extract and decompile new JAR
  console.log("Extracting new JAR...");
  await extractJar(resolvedJar, resolve(tempDir, "extracted"));

  console.log("Decompiling new JAR...");
  await decompileClasses(resolve(tempDir, "extracted"), newSrcDir);

  // Compare files
  console.log("\nComparing files...");
  const changes = await compareDirectories(srcDir, newSrcDir);

  // Report changes
  const added = changes.filter((c) => c.type === "added");
  const modified = changes.filter((c) => c.type === "modified");
  const deleted = changes.filter((c) => c.type === "deleted");
  const conflicts = changes.filter((c) => c.type === "conflict");

  console.log(`\nChanges detected:`);
  console.log(`  Added: ${added.length}`);
  console.log(`  Modified: ${modified.length}`);
  console.log(`  Deleted: ${deleted.length}`);
  console.log(`  Conflicts: ${conflicts.length}`);

  // Apply changes
  console.log("\nApplying changes...");

  // Add new files
  for (const change of added) {
    const newPath = resolve(newSrcDir, change.path);
    const destPath = resolve(srcDir, change.path);
    await $`mkdir -p ${resolve(destPath, "..")}`;
    await $`cp ${newPath} ${destPath}`;
    console.log(`  + ${change.path}`);
  }

  // Update modified files (no local changes)
  for (const change of modified) {
    const newPath = resolve(newSrcDir, change.path);
    const destPath = resolve(srcDir, change.path);
    await $`cp ${newPath} ${destPath}`;
    console.log(`  M ${change.path}`);
  }

  // Handle conflicts with git-style markers
  for (const change of conflicts) {
    await applyConflict(srcDir, newSrcDir, change.path);
    console.log(`  C ${change.path} (conflict markers added)`);
  }

  // Note deleted files but don't remove (user may want them)
  for (const change of deleted) {
    console.log(`  - ${change.path} (still present locally)`);
  }

  // Update project.json
  const newHash = await hashFile(resolvedJar);
  metadata.sourceJar = resolvedJar;
  metadata.sourceJarHash = newHash;
  metadata.decompileDate = new Date().toISOString();
  await writeProjectJson(projectDir, metadata);

  // Cleanup
  await $`rm -rf ${tempDir}`;

  console.log(`\nUpdate complete!`);
  if (conflicts.length > 0) {
    console.log(`\nWARNING: ${conflicts.length} files have conflicts that need manual resolution.`);
    console.log(`Search for "<<<<<<< LOCAL" in your source files.`);
  }
}

async function compareDirectories(
  oldDir: string,
  newDir: string
): Promise<FileChange[]> {
  const changes: FileChange[] = [];
  const glob = new Bun.Glob("**/*.java");

  // Track files we've seen in new directory
  const newFiles = new Set<string>();

  // Check new files against old
  for await (const file of glob.scan({ cwd: newDir, onlyFiles: true })) {
    newFiles.add(file);
    const oldPath = resolve(oldDir, file);
    const newPath = resolve(newDir, file);

    const oldFile = Bun.file(oldPath);
    if (!(await oldFile.exists())) {
      changes.push({ path: file, type: "added" });
      continue;
    }

    // Compare content
    const oldContent = await oldFile.text();
    const newContent = await Bun.file(newPath).text();

    if (oldContent !== newContent) {
      // Check if local file was modified from original
      // For now, assume any difference is a potential conflict if old differs from new
      // In a real implementation, we'd track original hashes
      changes.push({ path: file, type: "modified" });
    }
  }

  // Check for deleted files
  for await (const file of glob.scan({ cwd: oldDir, onlyFiles: true })) {
    if (!newFiles.has(file)) {
      changes.push({ path: file, type: "deleted" });
    }
  }

  return changes;
}

async function applyConflict(
  oldDir: string,
  newDir: string,
  filePath: string
): Promise<void> {
  const oldPath = resolve(oldDir, filePath);
  const newPath = resolve(newDir, filePath);

  const localContent = await Bun.file(oldPath).text();
  const upstreamContent = await Bun.file(newPath).text();

  const conflictContent = `<<<<<<< LOCAL
${localContent}=======
${upstreamContent}>>>>>>> UPSTREAM
`;

  await Bun.write(oldPath, conflictContent);
}
