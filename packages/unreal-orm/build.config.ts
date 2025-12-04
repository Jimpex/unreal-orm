import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
	entries: ["src/index"],
	declaration: true,
	clean: true,
	failOnWarn: false,
	rollup: {
		emitCJS: false,
		output: {
			entryFileNames: "[name].js",
		},
		esbuild: {
			target: "node18",
		},
	},
	externals: ["surrealdb"],
});
