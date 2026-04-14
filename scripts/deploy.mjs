import fs from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import deployUtils from "./deployUtils.cjs";

const { isPlainObject, mergeDeployData } = deployUtils;

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
 * Parse a JSON file into a plain object.
 *
 * @param {string} filePath Absolute path to the JSON file.
 * @returns {Promise<Record<string, unknown>>} Parsed object.
 */
async function readJsonObject(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!isPlainObject(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}`);
  }

  return parsed;
}

/**
 * Parse a JSON file when it exists, otherwise return an empty object.
 *
 * @param {string} filePath Absolute path to the JSON file.
 * @returns {Promise<Record<string, unknown>>} Parsed object or empty object.
 */
async function readJsonObjectIfExists(filePath) {
  try {
    return await readJsonObject(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

/**
 * Write JSON data with stable indentation and trailing newline.
 *
 * @param {string} filePath Absolute path to the JSON file.
 * @param {Record<string, unknown>} data JSON object to persist.
 * @returns {Promise<void>}
 */
async function writeJsonObject(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/**
 * Merge the repo-local deploy override into the destination plugin settings file.
 *
 * @param {string} sourcePath Absolute path to the repo override file.
 * @param {string} destinationPath Absolute path to the target plugin data file.
 * @returns {Promise<void>}
 */
async function deployDataFile(sourcePath, destinationPath) {
  const overrideData = await readJsonObject(sourcePath);
  const existingData = await readJsonObjectIfExists(destinationPath);
  const mergedData = mergeDeployData(existingData, overrideData);

  await writeJsonObject(destinationPath, mergedData);
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

    if (fileName === "data.json") {
      await deployDataFile(sourcePath, destinationPath);
      process.stdout.write(`Merged ${fileName} -> ${destinationPath}\n`);
      continue;
    }

    await fs.copyFile(sourcePath, destinationPath);
    process.stdout.write(`Copied ${fileName} -> ${destinationPath}\n`);
  }

  process.stdout.write(`Deploy complete: ${pluginDir}\n`);
}

deployPlugin().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
