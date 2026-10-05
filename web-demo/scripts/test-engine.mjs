import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { loadPyodide } from "pyodide";
const manifest = JSON.parse(
  await readFile(new URL("../public/engine/manifest.json", import.meta.url)),
);
const python = await loadPyodide();
for (const file of manifest.files) {
  const bytes = await readFile(
    new URL("../public/engine/" + file.path, import.meta.url),
  );
  assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256);
  const target = "/engine/" + file.path;
  python.FS.mkdirTree(target.slice(0, target.lastIndexOf("/")));
  python.FS.writeFile(target, bytes);
}
await python.runPythonAsync(
  "import sys\nsys.path.insert(0, '/engine')\nfrom browser_api import run_public",
);
const fixtures = JSON.parse(
  await readFile(new URL("../test-fixtures.json", import.meta.url)),
);
for (const params of fixtures) {
  const payload = JSON.stringify(params);
  python.globals.set("params_json", payload);
  const actual = JSON.parse(
    await python.runPythonAsync("run_public(params_json)"),
  );
  const native = spawnSync(
    process.env.PYTHON || "python",
    [
      "-c",
      "import sys; from browser_api import run_public; print(run_public(sys.stdin.read()))",
    ],
    {
      cwd: new URL("../../", import.meta.url),
      input: payload,
      encoding: "utf8",
    },
  );
  assert.equal(native.status, 0, native.stderr);
  const expected = JSON.parse(native.stdout);
  if (actual.results)
    for (const key of Object.keys(actual.results)) {
      delete actual.results[key].milliseconds;
      delete expected.results[key].milliseconds;
    }
  assert.deepEqual(actual, expected);
}
console.log(
  "Original source hashes and native/Pyodide parity passed for " +
    fixtures.length +
    " fixtures.",
);
