import { resolve, basename } from "path";
import { readProjectJson, getProjectDir } from "../lib/project";
import { $ } from "bun";

interface Library {
  downloads?: {
    artifact?: {
      path: string;
      url: string;
    };
  };
  name: string;
  rules?: Array<{
    action: string;
    os?: { name: string };
  }>;
}

interface VersionJson {
  libraries: Library[];
}

export async function setupLibs(projectName: string, minecraftDir?: string) {
  const projectDir = await getProjectDir(projectName);
  const metadata = await readProjectJson(projectDir);
  const libsDir = resolve(projectDir, "libs");

  // Default Minecraft directory
  const mcDir = minecraftDir ?? resolve(import.meta.dir, "../../../minecraft");

  console.log(`Setting up libraries for ${metadata.name}`);
  console.log(`Minecraft directory: ${mcDir}`);

  // Find version JSON
  const jarName = basename(metadata.sourceJar, ".jar");
  const versionJsonPath = resolve(mcDir, "versions", jarName, `${jarName}.json`);

  const versionFile = Bun.file(versionJsonPath);
  if (!(await versionFile.exists())) {
    console.error(`Version JSON not found: ${versionJsonPath}`);
    console.error(`Make sure you have this version installed in Minecraft launcher.`);
    process.exit(1);
  }

  const versionJson: VersionJson = await versionFile.json();
  console.log(`Found ${versionJson.libraries.length} libraries in version JSON`);

  // Ensure libs directory exists
  await $`mkdir -p ${libsDir}`;

  let copied = 0;
  let skipped = 0;
  let missing = 0;

  for (const lib of versionJson.libraries) {
    // Check platform rules (skip libraries not allowed on macOS)
    if (lib.rules) {
      // If there's an OS-specific allow rule that doesn't include macOS, skip this library
      const hasOsSpecificAllow = lib.rules.some(
        (r) => r.action === "allow" && r.os?.name
      );
      const allowsOsx = lib.rules.some(
        (r) => r.action === "allow" && r.os?.name === "osx"
      );
      const disallowsOsx = lib.rules.some(
        (r) => r.action === "disallow" && r.os?.name === "osx"
      );

      // Skip if: explicitly disallowed on macOS, or has OS-specific allows but none for macOS
      if (disallowsOsx || (hasOsSpecificAllow && !allowsOsx)) {
        skipped++;
        continue;
      }
    }

    if (!lib.downloads?.artifact?.path) {
      skipped++;
      continue;
    }

    const libPath = resolve(mcDir, "libraries", lib.downloads.artifact.path);
    const libFile = Bun.file(libPath);

    if (!(await libFile.exists())) {
      console.log(`  Missing: ${lib.name}`);
      missing++;
      continue;
    }

    const destPath = resolve(libsDir, basename(lib.downloads.artifact.path));

    // Skip if already exists
    if (await Bun.file(destPath).exists()) {
      skipped++;
      continue;
    }

    await $`cp ${libPath} ${destPath}`;
    copied++;
  }

  console.log(`\nLibraries setup complete:`);
  console.log(`  Copied: ${copied}`);
  console.log(`  Skipped (already exist or platform-specific): ${skipped}`);
  if (missing > 0) {
    console.log(`  Missing: ${missing} (may need to download)`);
  }

  // Count total libs
  const libCount = await $`ls ${libsDir}/*.jar 2>/dev/null | wc -l`.text();
  console.log(`\nTotal JARs in libs/: ${libCount.trim()}`);
}
