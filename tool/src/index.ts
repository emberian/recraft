#!/usr/bin/env bun
import { program } from "commander";
import { decompile } from "./commands/decompile";
import { compile } from "./commands/compile";
import { update } from "./commands/update";
import { setupLibs } from "./commands/setup-libs";
import { checkDecompile } from "./commands/check-decompile";
import { addPreserve } from "./commands/add-preserve";

program
  .name("mcmod")
  .description("Minecraft Java Edition modding toolchain")
  .version("0.1.0");

program
  .command("decompile")
  .description("Decompile a Minecraft JAR to Java source")
  .argument("<jar>", "Path to the Minecraft JAR file")
  .argument("[project-name]", "Name for the project directory")
  .action(decompile);

program
  .command("compile")
  .description("Compile Java source back to a JAR")
  .argument("<project>", "Project directory name")
  .argument("[output]", "Output JAR path")
  .action(compile);

program
  .command("update")
  .description("Update project source from a new JAR version")
  .argument("<project>", "Project directory name")
  .argument("<jar>", "Path to the new Minecraft JAR")
  .action(update);

program
  .command("setup-libs")
  .description("Copy required libraries from Minecraft installation")
  .argument("<project>", "Project directory name")
  .argument("[minecraft-dir]", "Path to .minecraft directory")
  .action(setupLibs);

program
  .command("check")
  .description("Check for decompilation artifacts and mark files for .class preservation")
  .argument("<project>", "Project directory name")
  .action(checkDecompile);

program
  .command("add-preserve")
  .description("Add Java files to the preservation list (use original .class instead of recompiling)")
  .argument("<project>", "Project directory name")
  .argument("<files...>", "Java files to preserve")
  .action(addPreserve);

program.parse();
