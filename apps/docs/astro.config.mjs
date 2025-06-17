// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc";

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
            // User-facing documentation
            { label: "Introduction", slug: "package/readme" },
            { label: "Capabilities", slug: "package/capabilities" },
            // { label: "Example Guide", slug: "guides/example" },
          ],
        },
        {
          label: "API Reference",
          autogenerate: { directory: "api" },
        },
        {
          label: "Contributing",
          items: [
            // Internal documentation for contributors
            { label: "Contributing Guide", slug: "package/internal/contributing" },
            { label: "Design Principles", slug: "package/design-principles" },
            { label: "Testing", slug: "package/internal/tests" },
          ],
        },
        // {
        //   label: "Additional Documentation",
        //   autogenerate: { directory: "package/additional" },
        // },
      ],
    }),
  ],
});
