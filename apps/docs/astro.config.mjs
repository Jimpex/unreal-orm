// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc";

import node from "@astrojs/node";

// https://astro.build/config

export default defineConfig({
	integrations: [
		starlight({
			plugins: [
				// Generate the documentation
				starlightTypeDoc({
					entryPoints: ["../../packages/unreal-orm/src/index.ts"],
					tsconfig: "../../packages/unreal-orm/tsconfig.json",
					watch: true,
					typeDoc: { skipErrorChecking: true },
				}),
			],
			title: "unreal-orm",
			logo: {
				dark: "./src/assets/unreal-orm-logo-white.svg",
				light: "./src/assets/unreal-orm-logo-black.svg",
				alt: "unreal-orm-logo",
				replacesTitle: true,
			},
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/jimpex/unreal-orm",
				},
			],
			sidebar: [
				{
					label: "Getting Started",
					items: [
						{ label: "Introduction", slug: "getting-started/readme" },
						{ label: "Capabilities", slug: "getting-started/capabilities" },
					],
				},
				{
					label: "Contributing",
					items: [
						{ label: "Contributing Guide", slug: "contributing/guide" },
						{
							label: "Design Principles",
							slug: "contributing/design-principles",
						},
					],
				},
				{
					label: "API Reference",
					autogenerate: { directory: "api" },
					collapsed: true,
				},
			],
		}),
	],
	adapter: node({
		mode: "standalone",
	}),
});
