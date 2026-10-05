# Cube Lab Browser Demo

Public production URL: https://star-cubing-khanh-demo.vercel.app

## Original Engines

The current repository's `src/algorithm/star_cubing.py`, `buc.py` and
`bottom_up.py` execute unchanged through pinned Pyodide 314.0.7. The browser
adapter encodes visitor-supplied dimension labels into integer IDs, calls each
engine, restores labels and compares cell keys, sales and transaction counts.
It does not port or replace the algorithms with handwritten JavaScript.

The published Star-Cubing engine is the source baseline scaffold. Its pruning
and compression can yield differences from Bottom-up under positive thresholds.
All source outputs are retained. The interface reports differing cells and a
warning, rather than suggesting universal equivalence. The enhanced Star-tree
algorithm and the four-way full benchmark remain in the research repository.

## Live Scope And Limits

- An explicit 24-row synthetic retail sample, with no real customer identifiers.
- Local editable JSON: Region, Category, Channel, nonnegative numeric sales.
- 1-80 rows, three fixed dimensions, at most six values per dimension.
- Labels are 1-24 printable characters; ALL is reserved for roll-up.
- Sales <= 1,000,000 and support <= 100,000,000; NaN/Infinity/bools are rejected.
- A 20 KB text-input limit and a 60-second cancellable worker deadline.
- Three algorithm result tables, measured execution time, roll-up/search filters.
- JSON export generated locally; no server submission or persistence.

Timings are small-run measurements on the visitor's device, excluding runtime
cold-load. They are not replacements for recorded CPU/RAM/storage benchmark
evidence. Aggregate cells overlap and must not be summed into a grand total.
No warehouse connection, private retail data or Power BI deployment is claimed.
JSON export payloads are inspectable; embedded-browser local data-URL download
capture remains unverified, consistent with earlier portfolio demos.

## Build And Verification

```powershell
python -m unittest test_browser_api.py
cd web-demo
npm ci
npm test
npm run build
npm run dev -- --port 3005
```

Four native tests cover zero-threshold agreement/grand total, threshold filtering,
empty output and invalid/bounded inputs. Three native/Pyodide fixtures verify
packaged source hashes and exact output parity, excluding machine-dependent time.

Vercel Git project: `star-cubing-khanh-demo`, root `web-demo`, Node 24.x. Runtime
assets are generated from the pinned package; tracked engine copies and their
SHA256 manifest allow standalone builds. Whole-repository builds refresh these
copies from the unchanged original modules. No paid backend or new secrets.

Development used a clean clone of the current remote to preserve unrelated local
benchmark changes in the original checkout. No benchmark charts/logs or datasets
were staged or overwritten.

Primary runtime reference: [Pyodide workers](https://pyodide.org/en/stable/usage/webworker.html).
