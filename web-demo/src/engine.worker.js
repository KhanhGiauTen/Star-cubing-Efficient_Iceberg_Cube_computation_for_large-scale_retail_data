let python;
self.onmessage = async ({ data }) => {
  try {
    if (!python) {
      self.postMessage({ type: "status", text: "Loading Python..." });
      const indexURL = new URL("/runtime/", self.location.origin).href;
      const { loadPyodide } = await import(
        /* @vite-ignore */ indexURL + "pyodide.mjs"
      );
      python = await loadPyodide({ indexURL });
      const response = await fetch("/engine/manifest.json");
      if (!response.ok) throw new Error("Engine manifest unavailable");
      const manifest = await response.json();
      for (const { path } of manifest.files) {
        const source = await fetch("/engine/" + path);
        if (!source.ok) throw new Error("Engine source unavailable: " + path);
        const target = "/engine/" + path;
        python.FS.mkdirTree(target.slice(0, target.lastIndexOf("/")));
        python.FS.writeFile(target, await source.text());
      }
      await python.runPythonAsync(
        "import sys\nsys.path.insert(0, '/engine')\nfrom browser_api import run_public",
      );
    }
    self.postMessage({
      type: "status",
      text: "Running original Python engine...",
    });
    python.globals.set("params_json", JSON.stringify(data));
    const started = performance.now();
    const result = JSON.parse(
      await python.runPythonAsync("run_public(params_json)"),
    );
    self.postMessage({
      type: "result",
      result,
      milliseconds: performance.now() - started,
    });
  } catch (error) {
    python = undefined;
    const detail = String(error.message)
      .trim()
      .split("\n")
      .filter(Boolean)
      .at(-1);
    self.postMessage({
      type: "error",
      text: detail.replace(/^(ValueError|TypeError):\s*/, ""),
    });
  }
};
