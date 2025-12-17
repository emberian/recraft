import { resolve } from "path";

export interface ProjectMetadata {
  name: string;
  sourceJar: string;
  sourceJarHash: string;
  decompileDate: string;
  vineflowerVersion: string;
}

export async function writeProjectJson(
  projectDir: string,
  metadata: ProjectMetadata
): Promise<void> {
  const path = resolve(projectDir, "project.json");
  await Bun.write(path, JSON.stringify(metadata, null, 2));
}

export async function readProjectJson(
  projectDir: string
): Promise<ProjectMetadata> {
  const path = resolve(projectDir, "project.json");
  const file = Bun.file(path);

  if (!(await file.exists())) {
    throw new Error(`Project not found: ${projectDir}`);
  }

  return file.json();
}

export async function getProjectDir(projectName: string): Promise<string> {
  // Project directory is sibling to tool/
  const toolDir = resolve(import.meta.dir, "../..");
  return resolve(toolDir, "..", projectName);
}
