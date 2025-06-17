#!/usr/bin/env bun
/**
 * copy-package-docs.ts
 * This script copies and processes markdown documentation files from the unreal-orm package
 * to the docs site content directory.
 */

import { join, resolve, dirname, relative } from 'path';
import { existsSync, mkdir, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { globSync } from 'glob';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

// Get current script directory with ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define types for better type safety
interface DocFile {
  sourcePath: string;
  targetPath: string;
  title: string;
  description: string;
}

interface CopyResult {
  success: boolean;
  message: string;
  error?: Error;
}

// Configuration
const PATHS = {
  ROOT: resolve(__dirname, '..'),
  REPO_ROOT: resolve(__dirname, '../../..'),  // Three levels up to reach repo root from scripts dir
  PACKAGE: resolve(__dirname, '../../../packages/unreal-orm'),
  CONTENT: resolve(__dirname, '../src/content'),
  DOCS: resolve(__dirname, '../src/content/docs'),
  TARGET: resolve(__dirname, '../src/content/docs/package'),
  INTERNAL: resolve(__dirname, '../src/content/docs/package/internal'),
};

/**
 * Helper function to truncate paths for cleaner logs
 */
function formatPath(fullPath: string): string {
  // Convert to relative path from repo root when possible
  const relativePath = relative(PATHS.REPO_ROOT, fullPath);
  
  // If the path starts with .., it's outside the repo root, so use the basename
  if (relativePath.startsWith('..')) {
    return fullPath.split(/[\\/]/).pop() || fullPath;
  }
  
  // Otherwise return the relative path from repo root
  return relativePath;
}

// Document definitions for copying
const DOCS_TO_COPY: DocFile[] = [
  // Main documentation
  {
    sourcePath: join(PATHS.PACKAGE, 'README.md'),
    targetPath: join(PATHS.TARGET, 'readme.md'),
    title: 'Introduction to unreal-orm',
    description: 'A type-safe ORM for SurrealDB, designed to stay close to native SurrealDB capabilities',
  },
  {
    sourcePath: join(PATHS.PACKAGE, 'CAPABILITIES.md'),
    targetPath: join(PATHS.TARGET, 'capabilities.md'),
    title: 'Capabilities',
    description: 'Features and capabilities of unreal-orm',
  },
  {
    sourcePath: join(PATHS.PACKAGE, 'src/DESIGN_PRINCIPLES.md'),
    targetPath: join(PATHS.TARGET, 'design-principles.md'),
    title: 'Design Principles',
    description: 'Core design principles and philosophy of unreal-orm',
  },
  // Internal documentation
  {
    sourcePath: join(PATHS.PACKAGE, 'tests/README.md'),
    targetPath: join(PATHS.INTERNAL, 'tests.md'),
    title: 'Testing Guidelines',
    description: 'Guide for testing unreal-orm',
  },
  {
    sourcePath: join(PATHS.REPO_ROOT, 'CONTRIBUTING.md'),
    targetPath: join(PATHS.INTERNAL, 'contributing.md'),
    title: 'Contributing Guide',
    description: 'Guidelines for contributing to unreal-orm',
  },
];

/**
 * Ensures all required directories exist
 */
function ensureDirectories(): void {
  const directories = [
    PATHS.CONTENT,
    PATHS.DOCS,
    PATHS.TARGET,
    PATHS.INTERNAL,
  ];

  for (const dir of directories) {
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
        console.log(chalk.green(`✓ Created directory: ${formatPath(dir)}`));
      } catch (error) {
        console.error(chalk.red(`✗ Failed to create directory: ${formatPath(dir)}`));
        console.error(error);
      }
    }
  }
}

/**
 * Copies and enhances a markdown file with frontmatter
 */
function copyMarkdownFile(docFile: DocFile): CopyResult {
  try {
    // Check if source file exists
    if (!existsSync(docFile.sourcePath)) {
      return {
        success: false,
        message: `Source file does not exist: ${docFile.sourcePath}`,
      };
    }

    // Read source content
    const content = readFileSync(docFile.sourcePath, 'utf-8');

    // Add frontmatter
    const enhancedContent = `---
title: ${docFile.title}
description: ${docFile.description}
---

${content}`;

    // Ensure parent directory exists before writing file
    const parentDir = path.dirname(docFile.targetPath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
    writeFileSync(docFile.targetPath, enhancedContent);

    return {
      success: true,
      message: `Copied ${formatPath(docFile.sourcePath)} to ${formatPath(docFile.targetPath)}`,
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
function copyAdditionalDocs(): void {
  const additionalDocsDir = join(PATHS.PACKAGE, 'docs');
  const additionalTargetDir = join(PATHS.TARGET, 'additional');

  if (!existsSync(additionalDocsDir)) {
    console.log(chalk.yellow(`ℹ No additional docs directory found at: ${formatPath(additionalDocsDir)}`));
    return;
  }

  // Create the additional docs directory if it doesn't exist
  if (!existsSync(additionalTargetDir)) {
    mkdir(additionalTargetDir, { recursive: true } as unknown as Parameters<typeof mkdir>[1]);
  }

  try {
    // Find all markdown files in the docs directory
    const markdownFiles = globSync('**/*.md', { cwd: additionalDocsDir });

    if (markdownFiles.length === 0) {
      console.log(chalk.yellow(`ℹ No markdown files found in: ${formatPath(additionalDocsDir)}`));
      return;
    }

    // Copy each markdown file
    for (const file of markdownFiles) {
      const sourcePath = join(additionalDocsDir, file);
      const fileName = file.replace(/\.md$/i, '').toLowerCase();
      const targetPath = join(additionalTargetDir, `${fileName}.md`);

      // Simple title generation from filename
      const title = fileName
        .split('-')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const docFile: DocFile = {
        sourcePath,
        targetPath,
        title,
        description: `Additional documentation: ${title}`,
      };

      const result = copyMarkdownFile(docFile);
      
      if (result.success) {
        console.log(chalk.green(`✓ ${result.message}`));
      } else {
        console.error(chalk.red(`✗ ${result.message}`));
        if (result.error) console.error(result.error);
      }
    }
  } catch (error) {
    console.error(chalk.red('✗ Failed to copy additional docs'));
    console.error(error);
  }
}

/**
 * Main function to run the script
 */
function main(): void {
  console.log(chalk.blue('📚 Copying documentation files...'));
  
  // Log paths for debugging (use brief paths)
  console.log(chalk.cyan('Working with paths:'));
  console.log(chalk.cyan(`  Repo root: ${PATHS.REPO_ROOT}`));
  console.log(chalk.cyan(`  Content directory: ${formatPath(PATHS.CONTENT)}`));
  
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
  
  // Copy any additional docs
  copyAdditionalDocs();
  
  // Print summary
  console.log(chalk.blue('\n📊 Summary:'));
  console.log(chalk.green(`✓ Successfully copied ${successCount} files`));
  if (failCount > 0) {
    console.log(chalk.yellow(`ℹ Skipped ${failCount} files (likely missing source files)`));
  }
  
  console.log(chalk.blue('✨ Documentation copying completed!'));
}

// Execute the script
main();
