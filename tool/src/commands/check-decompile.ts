import { resolve } from "path";
import { getProjectDir, readProjectJson, writeProjectJson } from "../lib/project";

// Patterns that indicate decompilation artifacts that won't compile
const DECOMPILE_ARTIFACTS = [
  /SwitchBootstraps\.typeSwitch</,
  /<VAR_NAMELESS/,
  /StringConcatFactory\.</,
  /LambdaMetafactory\.</,
  /\.<[A-Z]\s*>/,  // Suspicious single-letter generic like .<E> or .<T>
  /\.<Collection<\? extends [A-Z]>>/,  // Generic with unbound type param
];

export async function checkDecompile(projectName: string) {
  const projectDir = await getProjectDir(projectName);
  const metadata = await readProjectJson(projectDir);
  const srcDir = resolve(projectDir, "src");

  console.log(`Checking decompiled source for artifacts in ${metadata.name}...`);

  const glob = new Bun.Glob("**/*.java");
  const problematicFiles: string[] = [];

  for await (const file of glob.scan({ cwd: srcDir, onlyFiles: true })) {
    const filePath = resolve(srcDir, file);
    const content = await Bun.file(filePath).text();

    for (const pattern of DECOMPILE_ARTIFACTS) {
      if (pattern.test(content)) {
        problematicFiles.push(file);
        break;
      }
    }
  }

  if (problematicFiles.length === 0) {
    console.log("\nNo decompilation artifacts found! All files should compile.");
    return;
  }

  console.log(`\nFound ${problematicFiles.length} files with decompilation artifacts:`);
  for (const file of problematicFiles) {
    console.log(`  - ${file}`);
  }

  // Save to project.json for use during compilation
  const updatedMetadata = {
    ...metadata,
    preserveOriginalClasses: problematicFiles.map((f) =>
      f.replace(/\.java$/, ".class")
    ),
  };
  await writeProjectJson(projectDir, updatedMetadata);

  console.log(`\nSaved ${problematicFiles.length} files to project.json for original .class preservation.`);
  console.log(`These will be copied from the original JAR during compilation.`);
}
