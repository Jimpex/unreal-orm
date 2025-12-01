import chalk from "chalk";
import { createRequire } from "node:module";
import { ui } from "./ui";

const require = createRequire(import.meta.url);

/** Get CLI version from package.json */
function getCliVersion(): string {
	try {
		const pkg = require("../../package.json") as { version: string };
		return pkg.version;
	} catch {
		return "unknown";
	}
}

/** Current CLI version */
export const CLI_VERSION = getCliVersion();

/** NPM registry URLs */
const NPM_REGISTRY = "https://registry.npmjs.org";

interface NpmPackageInfo {
	"dist-tags": {
		latest: string;
		alpha?: string;
		beta?: string;
	};
	versions: Record<string, unknown>;
}

interface VersionCheckResult {
	current: string;
	latest: string;
	isOutdated: boolean;
}

/**
 * Fetch the latest version of a package from npm registry.
 */
async function fetchLatestVersion(
	packageName: string,
	tag: "latest" | "alpha" | "beta" = "alpha",
): Promise<string | null> {
	try {
		const response = await fetch(`${NPM_REGISTRY}/${packageName}`);
		if (!response.ok) return null;

		const data = (await response.json()) as NpmPackageInfo;
		return data["dist-tags"][tag] ?? data["dist-tags"].latest ?? null;
	} catch {
		return null;
	}
}

/**
 * Check if a newer version is available.
 */
async function checkPackageVersion(
	packageName: string,
	currentVersion: string,
	tag: "latest" | "alpha" | "beta" = "alpha",
): Promise<VersionCheckResult | null> {
	const latest = await fetchLatestVersion(packageName, tag);
	if (!latest) return null;

	return {
		current: currentVersion,
		latest,
		isOutdated: latest !== currentVersion,
	};
}

/**
 * Get the installed version of unreal-orm from the user's project.
 */
function getInstalledOrmVersion(): string | null {
	try {
		// Try to read from node_modules
		const pkgPath = require.resolve("unreal-orm/package.json", {
			paths: [process.cwd()],
		});
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const pkg = require(pkgPath) as { version: string };
		return pkg.version;
	} catch {
		return null;
	}
}

/**
 * Check for updates and display a message if newer versions are available.
 * This runs silently in the background and doesn't block the CLI.
 */
export async function checkForUpdates(): Promise<void> {
	// Don't check in CI environments
	if (process.env.CI || process.env.UNREAL_SKIP_UPDATE_CHECK) {
		return;
	}

	try {
		const [cliCheck, ormCheck] = await Promise.all([
			checkPackageVersion("@unreal-orm/cli", CLI_VERSION, "alpha"),
			(async () => {
				const installed = getInstalledOrmVersion();
				if (!installed) return null;
				return checkPackageVersion("unreal-orm", installed, "alpha");
			})(),
		]);

		const updates: string[] = [];

		if (cliCheck?.isOutdated) {
			updates.push(
				`  @unreal-orm/cli: ${ui.dim(cliCheck.current)} → ${ui.theme.success(cliCheck.latest)}`,
			);
		}

		if (ormCheck?.isOutdated) {
			updates.push(
				`  unreal-orm: ${ui.dim(ormCheck.current)} → ${ui.theme.success(ormCheck.latest)}`,
			);
		}

		if (updates.length > 0) {
			ui.newline();
			ui.warn("📦 Updates available:");
			for (const update of updates) {
				console.log(update);
			}
			ui.dim("\n  Run `npm update @unreal-orm/cli unreal-orm` to update\n");
		}
	} catch {
		// Silently ignore errors - version check is non-critical
	}
}

/**
 * Display version information.
 */
export function displayVersionInfo(): void {
	const ormVersion = getInstalledOrmVersion();

	ui.bold("UnrealORM CLI");
	console.log(`  CLI version: ${ui.theme.secondary(CLI_VERSION)}`);
	if (ormVersion) {
		console.log(`  ORM version: ${ui.theme.secondary(ormVersion)}`);
	} else {
		console.log(`  ORM version: ${ui.dim("not installed")}`);
	}
}
