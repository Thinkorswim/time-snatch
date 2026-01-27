import { exec } from "child_process";
import { promisify } from "util";
import { rename, unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Setup __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, "../dist");

// Convert exec to promise-based
const execAsync = promisify(exec);

const renameZip = async ({ command, expectedZips }) => {
  const { stdout, stderr } = await execAsync(command);
  
  if (stderr) {
    console.error(`⚠ Warning from ${command}:\n${stderr}`);
  }
  
  console.log(stdout);
  
  for (const [matchPattern, newName] of expectedZips) {
    const match = stdout.match(matchPattern);
    if (!match) {
      console.error(`❌ Could not find match for: ${matchPattern}`);
      continue;
    }
    const original = path.join(DIST_DIR, path.basename(match[0]));
    const renamed = path.join(DIST_DIR, newName);
    try {
      // Remove existing file if it exists
      await unlink(renamed).catch(() => {});
      await rename(original, renamed);
      console.log(`✔ Renamed: ${path.basename(original)} → ${newName}`);
    } catch (err) {
      console.error(`❌ Failed to rename ${original}: ${err}`);
    }
  }
};

// Chrome
await renameZip({
  command: "npm run zip",
  expectedZips: [
    [/dist\/([^\s]+chrome\.zip)/, "time-snatch-chrome.zip"]
  ]
});

// Firefox
await renameZip({
  command: "npm run zip:firefox",
  expectedZips: [
    [/dist\/([^\s]+firefox\.zip)/, "time-snatch-firefox.zip"],
    [/dist\/([^\s]+sources\.zip)/, "time-snatch-firefox-sources.zip"]
  ]
});

// Edge
await renameZip({
  command: "npm run zip:edge",
  expectedZips: [
    [/dist\/([^\s]+edge\.zip)/, "time-snatch-edge.zip"]
  ]
});