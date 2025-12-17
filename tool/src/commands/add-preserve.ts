import { resolve } from "path";
import { getProjectDir, readProjectJson, writeProjectJson, type ProjectMetadata } from "../lib/project";

interface ExtendedMetadata extends ProjectMetadata {
  preserveOriginalClasses?: string[];
}

export async function addPreserve(projectName: string, ...javaFiles: string[]) {
  const projectDir = await getProjectDir(projectName);
  const metadata = (await readProjectJson(projectDir)) as ExtendedMetadata;

  const existing = new Set(metadata.preserveOriginalClasses ?? []);
  let added = 0;

  for (const javaFile of javaFiles) {
    // Convert java path to class path
    const classFile = javaFile
      .replace(/^.*\/src\//, "")  // Remove prefix up to src/
      .replace(/\.java$/, ".class");

    if (!existing.has(classFile)) {
      existing.add(classFile);
      added++;
      console.log(`  + ${classFile}`);
    }
  }

  const updatedMetadata: ExtendedMetadata = {
    ...metadata,
    preserveOriginalClasses: Array.from(existing).sort(),
  };
  await writeProjectJson(projectDir, updatedMetadata);

  console.log(`\nAdded ${added} files. Total preserved: ${existing.size}`);
}
