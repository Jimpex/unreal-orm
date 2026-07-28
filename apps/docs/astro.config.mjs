// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc";

import node from "@astrojs/node";

import vercel from "@astrojs/vercel";
import starlightThemeGalaxyPlugin from "starlight-theme-galaxy";

// https://astro.build/config

export default defineConfig({
  integrations: [
    starlight({
      plugins: [
        // @ts-ignore
        starlightThemeGalaxyPlugin(),
        // Generate the documentation
        starlightTypeDoc({
          entryPoints: ["../../packages/unreal-orm/src/index.ts"],
          tsconfig: "../../packages/unreal-orm/tsconfig.json",
          watch: true,
          typeDoc: { skipErrorChecking: true },
        }),
      ],
      title: "unreal-orm",
      customCss: ["./src/styles/custom.css"],
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
            { label: "What is SurrealDB?", slug: "getting-started/what-is-surrealdb" },
            { label: "Installation", slug: "getting-started/installation" },
            { label: "Quickstart", slug: "getting-started/quickstart" },
            { label: "Capabilities", slug: "getting-started/capabilities" },
          ],
        },
        {
          label: "Concepts",
          items: [
            { label: "Models and Tables", slug: "concepts/models-and-tables" },
            { label: "Fields and Types", slug: "concepts/fields-and-types" },
            { label: "Indexes", slug: "concepts/indexes" },
            { label: "Schema Application", slug: "concepts/schema-application" },
            { label: "SurrealQL Mapping", slug: "concepts/surrealql-mapping" },
          ],
        },
        {
          label: "Querying",
          items: [
            { label: "Selecting", slug: "querying/selecting" },
            { label: "Inserting", slug: "querying/inserting" },
            { label: "Updating", slug: "querying/updating" },
            { label: "Deleting", slug: "querying/deleting" },
            { label: "Relations", slug: "querying/relations" },
            { label: "Where Builder", slug: "querying/where-builder" },
          ],
        },
        {
          label: "Advanced",
          items: [
            { label: "Security and Permissions", slug: "advanced/permissions" },
            { label: "Full-Text Search", slug: "advanced/full-text-search" },
            { label: "Geospatial Data", slug: "advanced/geospatial" },
            { label: "File Storage", slug: "advanced/file-storage" },
            { label: "Testing", slug: "advanced/testing" },
            { label: "Migrations and Schema Diff", slug: "advanced/migrations" },
            { label: "SDK Interoperability", slug: "advanced/sdk-interop" },
            { label: "CLI Usage", slug: "advanced/cli-usage" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Tutorial", slug: "guides/unreal-orm-tutorial" },
            { label: "Cookbook", slug: "guides/cookbook" },
            { label: "Graph Relations", slug: "guides/graph-relations" },
            { label: "Common Patterns", slug: "guides/patterns" },
            { label: "Migrations & Schema Sync", slug: "guides/migrations" },
            { label: "Using with AI", slug: "guides/ai-usage" },
            { label: "Migrating to 1.0.0 alpha", slug: "guides/migrating-to-alpha" },
          ],
          collapsed: true,
        },
        {
          label: "CLI Reference",
          autogenerate: { directory: "cli" },
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
        {
          label: "Changelog",
          autogenerate: { directory: "changelog" },
        },
      ],
    }),
  ],
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
    maxDuration: 8,
  }),
});
