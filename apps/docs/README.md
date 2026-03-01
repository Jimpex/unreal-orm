# UnrealORM Documentation Site

This is the source code for the official UnrealORM documentation, built with [Astro](https://astro.build/) and [Starlight](https://starlight.astro.build/).

## 🚀 Getting Started

To run the documentation site locally:

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start the development server:
   ```bash
   pnpm dev
   ```
3. Open your browser at `http://localhost:4321`.

## 📖 Content Structure

Documentation content is located in `src/content/docs/`:
- `api/`: Automatically generated API reference (via TypeDoc)
- `cli/`: Manual reference for the UnrealORM CLI
- `guides/`: Tutorials and migration guides
- `getting-started/`: Installation and basic usage

## 🧞 Commands

| Command | Action |
| :--- | :--- |
| `pnpm dev` | Starts local dev server at `localhost:4321` |
| `pnpm build` | Build the production site to `./dist/` |
| `pnpm preview` | Preview the build locally |
| `pnpm astro ...` | Run Astro CLI commands |

## 🤝 Contributing

We welcome contributions to the documentation! Please see our [Contributing Guide](https://unreal-orm.jimpex.dev/contributing/guide/) for details on how to get started.
