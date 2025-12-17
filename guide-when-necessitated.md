# Recraft - Minecraft Java Edition Modding Toolchain

A toolchain for decompiling, modifying, and recompiling Minecraft Java Edition.

## Prerequisites

- [Bun](https://bun.sh/) runtime
- [Vineflower](https://github.com/Vineflower/vineflower) decompiler (installed at `/opt/homebrew/bin/vineflower`)
- Java 25+ with preview features
- `jq` for JSON parsing (used by launch script)
- Minecraft Java Edition installed (for libraries)

## Installation

```bash
cd tool
bun install
```

## Workflow

### 1. Decompile a Minecraft JAR

```bash
cd tool
bun run src/index.ts decompile /path/to/minecraft.jar [project-name]
```

This creates a project directory with:
- `src/` - Decompiled Java source files
- `resources/` - Non-class files (assets, data, etc.)
- `libs/` - Library JARs (populated in next step)
- `project.json` - Project metadata

### 2. Set up libraries

Copy required library JARs from your Minecraft installation:

```bash
bun run src/index.ts setup-libs <project-name> [minecraft-dir]
```

Default minecraft-dir is `~/Library/Application Support/minecraft` on macOS.

### 3. Check for decompilation artifacts

Some files may not decompile cleanly. This command finds them and marks them for preservation:

```bash
bun run src/index.ts check <project-name>
```

Files with decompilation artifacts will use the original `.class` files instead of being recompiled.

### 4. Make your modifications

Edit the Java source files in `<project>/src/`. For example, to add splash text to the title screen, modify `net/minecraft/client/gui/screens/TitleScreen.java`.

### 5. Manually preserve files (optional)

If compilation fails on specific files, add them to the preservation list:

```bash
bun run src/index.ts add-preserve <project-name> <java-files...>
```

### 6. Compile

```bash
bun run src/index.ts compile <project-name> [output.jar]
```

This:
- Compiles all Java source (except preserved files)
- Copies original `.class` files for preserved entries
- Copies resources
- Creates the modded JAR

### 7. Run the modded game

Use the provided launch script:

```bash
./launch-modded.sh
```

Or configure the Minecraft launcher to use your modded JAR.

## Commands Reference

| Command | Description |
|---------|-------------|
| `decompile <jar> [name]` | Decompile a Minecraft JAR to a new project |
| `compile <project> [output]` | Compile project back to JAR |
| `setup-libs <project> [mc-dir]` | Copy library JARs from Minecraft installation |
| `check <project>` | Find files with decompilation artifacts |
| `add-preserve <project> <files...>` | Manually mark files to use original .class |
| `update <project> <jar>` | Update project from a new Minecraft version |

## Project Structure

```
recraft/
├── tool/                    # The mcmod toolchain
│   └── src/
│       ├── index.ts         # CLI entry point
│       ├── commands/        # Command implementations
│       └── lib/             # Shared utilities
├── mc-26.1/                 # Example project
│   ├── src/                 # Decompiled Java source
│   ├── resources/           # Assets, data files
│   ├── libs/                # Library JARs
│   └── project.json         # Project metadata
└── launch-modded.sh         # Launch script for macOS
```

## How Preservation Works

Some Java files don't decompile perfectly - they may contain artifacts like:
- `SwitchBootstraps.typeSwitch`
- `LambdaMetafactory`
- Nameless variables

These files are added to `preserveOriginalClasses` in `project.json`. During compilation:
1. The file is excluded from javac
2. The original `.class` is copied from the source JAR
3. Inner classes are also copied automatically

## Troubleshooting

### NoSuchMethodError at runtime

This usually means wrong library versions on the classpath. The launch script parses the version JSON to include only the correct libraries. Make sure you're using `launch-modded.sh` or properly constructing the classpath.

### Compilation errors

If a file fails to compile:
1. Check if it's a decompilation artifact issue
2. Run `bun run src/index.ts add-preserve <project> path/to/File.java`
3. Recompile

### Missing libraries

Run `setup-libs` to copy libraries from your Minecraft installation. Make sure the version is installed in the launcher first.

## License

For personal/educational use. Minecraft is property of Mojang/Microsoft.
