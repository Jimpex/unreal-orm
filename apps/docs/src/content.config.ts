import { defineCollection, z } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				// Add a default value to the built-in `banner` field
				banner: z
					.object({
						content: z.string(),
					})
					.default({
						content:
							'🚀 This documentation is for <strong>unreal-orm 1.0.0 alpha</strong> which requires <strong>SurrealDB 2.0 alpha SDK</strong>. For the stable version, see <a href="https://www.npmjs.com/package/unreal-orm">npm</a>.',
					}),
			}),
		}),
	}),
};
