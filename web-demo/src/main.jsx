import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  Boxes,
  Play,
  Square,
  RotateCcw,
  Download,
  Github,
  Check,
} from "lucide-react";
import { useEngine, dataUrl } from "./use-engine";
import "./styles.css";

const DIMENSIONS = ["Region", "Category", "Channel"];
const SAMPLE = Array.from({ length: 24 }, (_, index) => ({
  Region: ["North", "South", "Central"][index % 3],
  Category: ["Books", "Tech", "Home"][Math.floor(index / 3) % 3],
  Channel: ["Web", "Store"][Math.floor(index / 9) % 2],
  sales: 80 + ((index * 37) % 240),
}));
const SOURCE =
  "https://github.com/KhanhGiauTen/Star-cubing-Efficient_Iceberg_Cube_computation_for_large-scale_retail_data";
const format = (value) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

function App() {
  const [rowsText, setRowsText] = useState(JSON.stringify(SAMPLE, null, 2));
  const [support, setSupport] = useState("0");
  const [algorithm, setAlgorithm] = useState("Star-Cubing");
  const [query, setQuery] = useState("");
  const [granularity, setGranularity] = useState("all");
  const [inputError, setInputError] = useState("");
  const engine = useEngine();
  const result = engine.result;
  const model = result?.results[algorithm];
  const stale =
    result && engine.completedKey !== JSON.stringify([rowsText, support]);
  const tableRows = useMemo(
    () =>
      (model?.rows || [])
        .filter((row) => {
          const concrete = DIMENSIONS.filter(
            (dim) => row[dim] !== "ALL",
          ).length;
          return (
            (granularity === "all" || concrete === Number(granularity)) &&
            DIMENSIONS.some((dim) =>
              row[dim].toLowerCase().includes(query.toLowerCase()),
            )
          );
        })
        .sort((a, b) => b.total_sales - a.total_sales),
    [model, query, granularity],
  );
  const run = (event) => {
    event.preventDefault();
    setInputError("");
    try {
      if (rowsText.length > 20000) throw new Error("Input exceeds 20 KB.");
      const rows = JSON.parse(rowsText);
      const minimum = Number(support);
      if (support.trim() === "" || !Number.isFinite(minimum))
        throw new Error("Minimum sales must be finite.");
      engine.run(
        { rows, min_support: minimum },
        JSON.stringify([rowsText, support]),
      );
    } catch (error) {
      setInputError(error.message);
    }
  };
  const maxTime = result
    ? Math.max(
        0.01,
        ...Object.values(result.results).map((item) => item.milliseconds),
      )
    : 1;
  return (
    <>
      <header>
        <strong>
          <Boxes />
          Cube Lab
        </strong>
        <nav>
          <a href="https://khanh-portfolio-ochre.vercel.app/projects/star-cubing-miner">
            <ArrowLeft /> Portfolio
          </a>
          <a href={SOURCE} target="_blank" rel="noreferrer">
            <Github /> Source
          </a>
        </nav>
      </header>
      <main>
        <div className="heading">
          <div>
            <div className="eyebrow">Data mining / Iceberg cubes</div>
            <h1>Aggregate. Compare. Inspect.</h1>
          </div>
          <span className="badge">
            <Check />
            Original Python algorithms
          </span>
        </div>
        <div className="workspace">
          <aside className="controls">
            <h2>Transactions</h2>
            <form onSubmit={run}>
              <label>
                Minimum aggregate sales
                <input
                  type="number"
                  min="0"
                  max="100000000"
                  step="any"
                  value={support}
                  required
                  onChange={(event) => setSupport(event.target.value)}
                />
              </label>
              <label>
                Transaction JSON
                <textarea
                  aria-label="Transaction JSON"
                  value={rowsText}
                  maxLength={20000}
                  onChange={(event) => setRowsText(event.target.value)}
                  spellCheck="false"
                />
              </label>
              <div className="actions">
                <button className="primary" disabled={engine.busy}>
                  <Play />
                  Compute cube
                </button>
                {engine.busy && (
                  <button type="button" onClick={engine.stop}>
                    <Square />
                    Stop
                  </button>
                )}
                <button
                  type="button"
                  title="Restore synthetic transactions"
                  onClick={() => {
                    setRowsText(JSON.stringify(SAMPLE, null, 2));
                    setSupport("0");
                    setInputError("");
                  }}
                >
                  <RotateCcw />
                  Sample
                </button>
              </div>
            </form>
            <p className="status" role="status">
              {engine.status}
            </p>
            {(inputError || engine.error) && (
              <p role="alert" className="error">
                {inputError || engine.error}
              </p>
            )}
            <p className="muted disclosure">
              Synthetic retail records. Up to 80 transactions, three dimensions,
              six values per dimension. No customer or private sales data is
              included.
            </p>
            <p className="muted">
              The original Star-Cubing baseline, BUC and Bottom-up run locally.
              Timings reflect this small browser run, not the repository's
              large-scale benchmark.
            </p>
          </aside>
          <section className="result-area" aria-label="Cube results">
            {stale && (
              <div className="stale">
                Inputs changed. Results below belong to the last completed run.
              </div>
            )}
            <div className="toolbar">
              <h2>Algorithm comparison</h2>
              {result && (
                <a
                  className="export"
                  download="cube-comparison.json"
                  href={dataUrl(result)}
                >
                  <Download />
                  JSON
                </a>
              )}
            </div>
            <div className="comparison">
              {["Star-Cubing", "BUC", "Bottom-up"].map((name) => (
                <article
                  className={`algorithm ${algorithm === name ? "active" : ""}`}
                  key={name}
                >
                  <button
                    aria-pressed={algorithm === name}
                    onClick={() => setAlgorithm(name)}
                  >
                    {name}
                  </button>
                  <strong>
                    {result ? result.results[name].rows.length : "--"}
                  </strong>
                  <p>
                    Cuboid cells ·{" "}
                    {result
                      ? `${result.results[name].milliseconds.toFixed(2)} ms`
                      : "not computed"}
                  </p>
                  <div className="bar">
                    <div
                      style={{
                        width: result
                          ? `${Math.max(2, (result.results[name].milliseconds / maxTime) * 100)}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <p>
                    {result
                      ? `${result.results[name].differences} differing cells vs Bottom-up`
                      : "No completed comparison"}
                  </p>
                </article>
              ))}
            </div>
            {result?.results["Star-Cubing"].differences > 0 && (
              <div className="warning">
                The original Star-Cubing baseline differs from Bottom-up on this
                input. Counts, omitted cells and sales are compared; differences
                are retained rather than silently replaced.
              </div>
            )}
            <div className="metrics">
              <div className="metric">
                <span>Input rows</span>
                <strong>{result?.input_rows ?? "--"}</strong>
              </div>
              <div className="metric">
                <span>Total input sales</span>
                <strong>{result ? format(result.total_sales) : "--"}</strong>
              </div>
              <div className="metric">
                <span>Minimum sales</span>
                <strong>{result ? format(result.min_support) : "--"}</strong>
              </div>
              <div className="metric">
                <span>Dimension count</span>
                <strong>3</strong>
              </div>
            </div>
            <div className="section-title">
              <h2>{algorithm} / Cube cells</h2>
              <span className="muted">
                {tableRows.length} visible
                {model ? ` / ${model.rows.length}` : ""}
              </span>
            </div>
            <div className="cube-summary">
              <input
                aria-label="Search dimension values"
                placeholder="Search dimension values"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select
                aria-label="Roll-up level"
                value={granularity}
                onChange={(event) => setGranularity(event.target.value)}
              >
                <option value="all">All roll-up levels</option>
                <option value="0">Grand total</option>
                <option value="1">One concrete dimension</option>
                <option value="2">Two concrete dimensions</option>
                <option value="3">Three concrete dimensions</option>
              </select>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {DIMENSIONS.map((dim) => (
                      <th key={dim}>{dim}</th>
                    ))}
                    <th className="numeric">Sales</th>
                    <th className="numeric">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={DIMENSIONS.map((dim) => row[dim]).join("\u0000")}>
                      {DIMENSIONS.map((dim) => (
                        <td key={dim}>{row[dim]}</td>
                      ))}
                      <td className="numeric">{format(row.total_sales)}</td>
                      <td className="numeric">{row.count_txn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!tableRows.length && (
                <div className="empty">
                  {result
                    ? "No cells match the selected threshold or filters."
                    : "No cube computed yet"}
                </div>
              )}
            </div>
            <p className="muted">
              ALL denotes a roll-up across that dimension. Aggregate cells
              overlap; their sales should not be summed together.
            </p>
          </section>
        </div>
        <footer>
          <span>Nguyen Quoc Khanh / Team benchmark contribution</span>
          <span>Browser sandbox / no warehouse or Power BI service</span>
        </footer>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
