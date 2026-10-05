import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
const config = JSON.parse(
  await readFile(new URL("../engine-files.json", import.meta.url)),
);
const runtime = new URL("../public/runtime/", import.meta.url);
await mkdir(runtime, { recursive: true });
const source = new URL("../node_modules/pyodide/", import.meta.url);
for (const file of await readdir(source)) {
  if (/\.(mjs|js|wasm|zip|json)$/.test(file))
    await copyFile(new URL(file, source), new URL(file, runtime));
}
const engine = new URL("../public/engine/", import.meta.url);
await mkdir(engine, { recursive: true });
const manifest = { runtime: "pyodide 314.0.7", files: [] };
for (const file of config) {
  const original = new URL("../../" + file, import.meta.url);
  const destination = new URL(file, engine);
  await mkdir(new URL("./", destination), { recursive: true });
  try {
    await access(original);
    await copyFile(original, destination);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await access(destination);
  }
  const bytes = await readFile(destination);
  manifest.files.push({
    path: file,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
await writeFile(
  new URL("manifest.json", engine),
  JSON.stringify(manifest, null, 2) + "\n",
);
