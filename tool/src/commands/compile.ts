import { resolve, dirname } from "path";
import { readProjectJson, getProjectDir, type ProjectMetadata } from "../lib/project";
import { compileJava, findLibraries } from "../lib/javac";
import { createJar, extractJar } from "../lib/jar";
import { $ } from "bun";

interface ExtendedMetadata extends ProjectMetadata {
  preserveOriginalClasses?: string[];
}

export async function compile(projectName: string, outputPath?: string) {
  const projectDir = await getProjectDir(projectName);
  const metadata = (await readProjectJson(projectDir)) as ExtendedMetadata;

  console.log(`Compiling project: ${metadata.name}`);

  const srcDir = resolve(projectDir, "src");
  const resourcesDir = resolve(projectDir, "resources");
  const libsDir = resolve(projectDir, "libs");
  const tempDir = resolve(projectDir, ".build");
  const classesDir = resolve(tempDir, "classes");

  // Clean and create build directory
  await $`rm -rf ${tempDir}`;
  await $`mkdir -p ${classesDir}`;

  // Find library JARs for classpath
  const classpath = await findLibraries(libsDir);
  if (classpath.length > 0) {
    console.log(`Using ${classpath.length} library JARs in classpath`);
  }

  // Get list of files to exclude from compilation (will use original .class)
  const preserveClasses = metadata.preserveOriginalClasses ?? [];
  const excludeJavaFiles = new Set(
    preserveClasses.map((c) => c.replace(/\.class$/, ".java"))
  );

  // Add original JAR to classpath so preserved classes and their inner classes are available
  if (preserveClasses.length > 0) {
    console.log(`Preserving ${preserveClasses.length} original .class files`);
    console.log("Adding original JAR to classpath...");
    classpath.push(metadata.sourceJar);
  }

  // Also extract original JAR for copying preserved classes later
  const jarExtractDir = resolve(tempDir, "original-classes");
  if (preserveClasses.length > 0) {
    await $`mkdir -p ${jarExtractDir}`;
    await extractJar(metadata.sourceJar, jarExtractDir);
  }

  // Compile Java source (excluding preserved files)
  await compileJava({
    sourceDir: srcDir,
    outputDir: classesDir,
    classpath,
    excludeFiles: excludeJavaFiles,
  });

  // Copy preserved .class files to output (including inner classes)
  if (preserveClasses.length > 0) {
    console.log("Copying preserved .class files to output...");
    for (const classFile of preserveClasses) {
      const srcPath = resolve(jarExtractDir, classFile);
      const destPath = resolve(classesDir, classFile);
      const classDir = dirname(classFile);
      const className = classFile.replace(/\.class$/, "").split("/").pop()!;

      await $`mkdir -p ${dirname(destPath)}`;

      // Copy the main class file
      if (await Bun.file(srcPath).exists()) {
        await $`cp ${srcPath} ${destPath}`;
      }

      // Copy all inner classes using glob
      const innerGlob = new Bun.Glob(`${className}$*.class`);
      const classSourceDir = resolve(jarExtractDir, classDir);

      try {
        for await (const innerFile of innerGlob.scan({ cwd: classSourceDir, onlyFiles: true })) {
          const innerSrc = resolve(classSourceDir, innerFile);
          const innerDest = resolve(classesDir, classDir, innerFile);
          await $`cp ${innerSrc} ${innerDest}`;
        }
      } catch {
        // Directory might not exist
      }
    }
  }

  // Copy resources to classes directory
  console.log("Copying resources...");
  const resourcesExist = await Bun.file(resolve(resourcesDir, "META-INF/MANIFEST.MF")).exists();
  if (resourcesExist || (await $`ls ${resourcesDir} 2>/dev/null`.quiet().exitCode) === 0) {
    await $`cp -r ${resourcesDir}/* ${classesDir}/`.quiet().nothrow();
  }

  // Determine output JAR path
  const output = outputPath
    ? resolve(outputPath)
    : resolve(projectDir, `${metadata.name}-modded.jar`);

  // Check for manifest
  const manifestPath = resolve(classesDir, "META-INF/MANIFEST.MF");
  const hasManifest = await Bun.file(manifestPath).exists();

  // Create JAR
  console.log(`Creating JAR: ${output}`);
  await createJar(classesDir, output, hasManifest ? manifestPath : undefined);

  // Cleanup
  await $`rm -rf ${tempDir}`;

  console.log(`\nCompilation complete: ${output}`);
}
