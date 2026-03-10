import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

// Running from apps/docs/scripts
const SCRIPT_DIR = import.meta.dirname;
const DOCS_ROOT = path.join(SCRIPT_DIR, "..");
const CONTENT_DIR = path.join(DOCS_ROOT, "src/content/docs");
const PUBLIC_DIR = path.join(DOCS_ROOT, "public");

const LLMS_TXT_PATH = path.join(PUBLIC_DIR, "llms.txt");
const LLMS_FULL_TXT_PATH = path.join(PUBLIC_DIR, "llms-full.txt");

async function generate() {
	console.log("Generating llms.txt and llms-full.txt in public/...");

	const files = await glob("**/*.{md,mdx}", { cwd: CONTENT_DIR });

	let fullContent = "# Unreal ORM - Full Documentation\n\n";
	fullContent += "> This file aggregates all documentation for Unreal ORM.\n\n";

	// Sort files for consistent output
	files.sort();

	for (const file of files) {
		const filePath = path.join(CONTENT_DIR, file);
		const content = fs.readFileSync(filePath, "utf-8");

		// Remove frontmatter
		const cleanContent = content.replace(/^---[\s\S]*?---/, "").trim();

		const title = cleanContent.split("\n")[0].replace(/^#\s*/, "") || file;

		fullContent += `## ${title}\n\n`;
		fullContent += `Source: ${file}\n\n`;
		fullContent += cleanContent + "\n\n---\n\n";
	}

	// Ensure public dir exists (should already exist but good practice)
	if (!fs.existsSync(PUBLIC_DIR)) {
		fs.mkdirSync(PUBLIC_DIR, { recursive: true });
	}

	fs.writeFileSync(LLMS_FULL_TXT_PATH, fullContent);
	console.log(`Generated ${LLMS_FULL_TXT_PATH}`);

	// Initial llms.txt content
	const llmsTxtContent = `# llms.txt

> Unreal ORM: A type-safe ORM for SurrealDB.

## Documentation

- [Getting Started](https://unreal-orm.jimpex.dev/getting-started/readme/): Quickstart, installation, and onboarding.
- [Tutorial](https://unreal-orm.jimpex.dev/guides/unreal-orm-tutorial/): A step-by-step guide to building with Unreal ORM.
- [Cookbook](https://unreal-orm.jimpex.dev/guides/cookbook/): Common patterns and recipes.
- [Using with AI](https://unreal-orm.jimpex.dev/guides/ai-usage/): How to leverage AI tools with Unreal ORM.
- [Capabilities](https://unreal-orm.jimpex.dev/getting-started/capabilities/): Supported SurrealDB features.

## Guides

- [Migrations](https://unreal-orm.jimpex.dev/guides/migrations/): How to handle schema changes.
- [Security & Permissions](https://unreal-orm.jimpex.dev/guides/security-permissions/): Managing access control.
- [Testing](https://unreal-orm.jimpex.dev/guides/testing/): Strategies for testing your ORM models.
- [Graph Relations](https://unreal-orm.jimpex.dev/guides/graph-relations/): Working with SurrealDB's graph features.

## API Reference

- [API Home](https://unreal-orm.jimpex.dev/api/): Full API documentation.
- [Functions](https://unreal-orm.jimpex.dev/api/functions/): Core ORM functions.
- [Interfaces](https://unreal-orm.jimpex.dev/api/interfaces/): Type definitions and interfaces.

## Contributing

- [Design Principles](https://unreal-orm.jimpex.dev/contributing/design-principles/): Project philosophy.
- [Contributing Guide](https://unreal-orm.jimpex.dev/contributing/guide/): Code style and PR process.
`;

	fs.writeFileSync(LLMS_TXT_PATH, llmsTxtContent);
	console.log(`Generated ${LLMS_TXT_PATH}`);
}

generate().catch(console.error);
