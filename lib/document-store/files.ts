import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const dataDir = path.join(process.cwd(), "data");
const projectsDir = path.join(dataDir, "projects");
const promptTemplatesPath = path.join(dataDir, "prompt-templates.json");

function now() {
  return new Date().toISOString();
}

function ensureStoreDirs() {
  fs.mkdirSync(projectsDir, { recursive: true });
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tempPath, filePath);
}

function appendEvent(projectId: number, type: string, payload: unknown) {
  const eventPath = path.join(projectsDir, String(projectId), "events.ndjson");
  fs.mkdirSync(path.dirname(eventPath), { recursive: true });
  fs.appendFileSync(eventPath, `${JSON.stringify({ type, at: now(), payload })}\n`);
}

function projectDir(projectId: number) {
  return path.join(projectsDir, String(projectId));
}

function documentPath(projectId: number) {
  return path.join(projectDir(projectId), "document.json");
}

export {
  appendEvent,
  documentPath,
  ensureStoreDirs,
  now,
  projectDir,
  projectsDir,
  promptTemplatesPath,
  readJsonFile,
  writeJsonFile
};
