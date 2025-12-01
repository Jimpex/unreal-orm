import { Command } from "@commander-js/extra-typings";
import { ui } from "../utils/ui";

const DOCS_URL = "https://unreal-orm.jimpex.dev";

/**
 * Open the UnrealORM documentation in the default browser.
 */
export const docsCommand = new Command("docs")
	.description("Open the UnrealORM documentation")
	.action(async () => {
		const { exec } = await import("node:child_process");
		const { platform } = await import("node:os");

		const openCommand =
			platform() === "win32"
				? "start"
				: platform() === "darwin"
					? "open"
					: "xdg-open";

		exec(`${openCommand} ${DOCS_URL}`, (error) => {
			if (error) {
				ui.info(`Visit: ${DOCS_URL}`);
			}
		});
	});
