import { exec } from "child_process";
import { promisify } from "util";
import { readdir, rename, unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// dist directory
const DIST_DIR = path.join(__dirname, "../dist");

// Promisified exec
const execAsync = promisify(exec);

// Small delay to avoid CI FS race conditions
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a command, then find & rename a zip file in dist/
 */
const runAndRenameZip = async ({ command, filter, renameTo }) => {
  if (command) {
    const { stderr } = await execAsync(command);

    if (stderr && !stderr.includes("Some chunks are larger than 500 kB")) {
      console.warn(`Warning from "${command}":\n${stderr}`);
    }

    console.log(`Zip creation succeeded for command: "${command}"`);
  }

  // CI filesystem can lag slightly
  await sleep(300);

  const files = await readdir(DIST_DIR);
  const match = files.find(filter);

  if (!match) {
    console.error("No matching zip found");
    console.error("Files in dist/:", files);
    throw new Error("Zip file not found");
  }

  const from = path.join(DIST_DIR, match);
  const to = path.join(DIST_DIR, renameTo);

  await unlink(to).catch(() => {});
  await rename(from, to);

  console.log(`Renamed: ${match} → ${renameTo}`);
};

/* -------------------- Chrome -------------------- */
await runAndRenameZip({
  command: "npm run zip",
  filter: (f) => f.endsWith("-chrome.zip"),
  renameTo: "time-snatch-chrome.zip",
});

/* -------------------- Firefox -------------------- */
await runAndRenameZip({
  command: "npm run zip:firefox",
  filter: (f) => f.endsWith("-firefox.zip"),
  renameTo: "time-snatch-firefox.zip",
});

await runAndRenameZip({
  command: null, // already created by previous step
  filter: (f) => f.endsWith("-sources.zip"),
  renameTo: "time-snatch-firefox-sources.zip",
});

/* -------------------- Edge -------------------- */
await runAndRenameZip({
  command: "npm run zip:edge",
  filter: (f) => f.endsWith("-edge.zip"),
  renameTo: "time-snatch-edge.zip",
});

console.log("All extension zips created and renamed successfully");