#!/usr/bin/env bun
/**
 * copy-package-docs.ts
 * This script copies and processes markdown documentation files from the unreal-orm package
 * to the docs site content directory.
 */

import { join, resolve, dirname, relative } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import chalk from "chalk";
import { fileURLToPath } from "node:url";

// Get current script directory with ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Minimal type for copy operation
interface CopyFile {
  sourcePath: string;
  targetPath: string;
}

interface CopyResult {
  success: boolean;
  message: string;
  error?: Error;
}

// Configuration
const PATHS = {
  ROOT: resolve(__dirname, ".."),
  REPO_ROOT: resolve(__dirname, "../../.."),
  PACKAGE: resolve(__dirname, "../../../packages/unreal-orm"),
  GETTING_STARTED: resolve(__dirname, "../src/content/docs/getting-started"),
};

/**
 * Helper function to truncate paths for cleaner logs
 */
function formatPath(fullPath: string): string {
  // Convert to relative path from repo root when possible
  const relativePath = relative(PATHS.REPO_ROOT, fullPath);

  // If the path starts with .., it's outside the repo root, so use the basename
  if (relativePath.startsWith("..")) {
    return fullPath.split(/[\\/]/).pop() || fullPath;
  }

  // Otherwise return the relative path from repo root
  return relativePath;
}

// Document definitions for copying
const DOCS_TO_COPY: CopyFile[] = [
  {
    sourcePath: join(PATHS.PACKAGE, "README.md"),
    targetPath: join(PATHS.GETTING_STARTED, "readme.md"),
  },
];

/**
 * Ensures all required directories exist
 */
function ensureDirectories(): void {
  const directories = [PATHS.GETTING_STARTED];
  for (const dir of directories) {
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
        console.log(chalk.green(`✓ Created directory: ${formatPath(dir)}`));
      } catch (error) {
        console.error(
          chalk.red(`✗ Failed to create directory: ${formatPath(dir)}`)
        );
        console.error(error);
      }
    }
  }
}

/**
 * Copies and enhances a markdown file with frontmatter
 */
function copyMarkdownFile(docFile: CopyFile): CopyResult {
  try {
    if (!existsSync(docFile.sourcePath)) {
      return {
        success: false,
        message: `Source file does not exist: ${docFile.sourcePath}`,
      };
    }
    const content = readFileSync(docFile.sourcePath, "utf-8");
    const frontmatter =
      "---\ntitle: Introduction\ndescription: Getting started with unreal-orm and SurrealDB\n---\n\n";
    const parentDir = dirname(docFile.targetPath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
    writeFileSync(docFile.targetPath, frontmatter + content);
    return {
      success: true,
      message: `Copied ${formatPath(docFile.sourcePath)} to ${formatPath(
        docFile.targetPath
      )}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to process ${formatPath(docFile.sourcePath)}`,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Finds and copies additional markdown files from a docs directory
 */

/**
 * Main function to run the script
 */
function main(): void {
  console.log(chalk.blue("📚 Copying documentation files..."));

  // Log paths for debugging (use brief paths)
  console.log(chalk.cyan("Working with paths:"));
  console.log(chalk.cyan(`  Repo root: ${PATHS.REPO_ROOT}`));
  console.log(
    chalk.cyan(
      `  Getting Started directory: ${formatPath(PATHS.GETTING_STARTED)}`
    )
  );

  // Ensure directories exist
  ensureDirectories();

  // Copy the defined markdown files
  let successCount = 0;
  let failCount = 0;

  for (const docFile of DOCS_TO_COPY) {
    const result = copyMarkdownFile(docFile);

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
      successCount++;
    } else {
      console.log(chalk.yellow(`ℹ ${result.message}`));
      if (result.error) console.error(result.error);
      failCount++;
    }
  }

  // Print summary
  console.log(chalk.blue("\n📊 Summary:"));
  console.log(chalk.green(`✓ Successfully copied ${successCount} files`));
  if (failCount > 0) {
    console.log(
      chalk.yellow(`ℹ Skipped ${failCount} files (likely missing source files)`)
    );
  }
  console.log(chalk.blue("✨ Documentation copying completed!"));
}

// Execute the script
main();
