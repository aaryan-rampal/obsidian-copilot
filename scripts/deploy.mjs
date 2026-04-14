import fs from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const DEFAULT_PLUGIN_DIR = path.join(
  os.homedir(),
  "personal",
  "obsidian",
  ".obsidian",
  "plugins",
  "copilot"
);

const REQUIRED_FILES = ["main.js", "manifest.json", "styles.css", "data.json"];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve the destination plugin directory.
 *
 * @returns {string} Absolute path to the target Obsidian plugin directory.
 */
function getPluginDir() {
  return process.env.OBSIDIAN_PLUGIN_DIR || DEFAULT_PLUGIN_DIR;
}

/**
 * Ensure a file exists before deployment.
 *
 * @param {string} filePath Absolute path to the file.
 * @returns {Promise<void>}
 */
async function assertFileExists(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

/**
 * Copy the built plugin artifacts into the target Obsidian plugin directory.
 *
 * @returns {Promise<void>}
 */
async function deployPlugin() {
  const repoRoot = path.resolve(__dirname, "..");
  const pluginDir = getPluginDir();

  await fs.mkdir(pluginDir, { recursive: true });

  for (const fileName of REQUIRED_FILES) {
    const sourcePath = path.join(repoRoot, fileName);
    const destinationPath = path.join(pluginDir, fileName);

    await assertFileExists(sourcePath);
    await fs.copyFile(sourcePath, destinationPath);
    console.log(`Copied ${fileName} -> ${destinationPath}`);
  }

  console.log(`Deploy complete: ${pluginDir}`);
}

deployPlugin().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
