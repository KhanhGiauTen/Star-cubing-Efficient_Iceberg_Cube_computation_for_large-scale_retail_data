"""Safe, small-data comparison of the original cube implementations."""
import json
import math
from time import perf_counter
from src.algorithm.buc import FactRow, compute_buc_cube
from src.algorithm.bottom_up import compute_bottom_up_cube
from src.algorithm.star_cubing import compute_star_cubing_cube

DIMENSIONS = ("Region", "Category", "Channel")
ALGORITHMS = {"Star-Cubing": compute_star_cubing_cube,
              "BUC": compute_buc_cube, "Bottom-up": compute_bottom_up_cube}


def finite_number(value, minimum, maximum):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("Measures must be numeric.")
    if not math.isfinite(value) or not minimum <= value <= maximum:
        raise ValueError(f"Measures must be between {minimum} and {maximum}.")
    return value


def run_public(payload):
    params = json.loads(payload)
    if not isinstance(params, dict) or set(params) != {"rows", "min_support"}:
        raise ValueError("Expected rows and min_support only.")
    support = finite_number(params["min_support"], 0, 100000000)
    records = params["rows"]
    if not isinstance(records, list) or not 1 <= len(records) <= 80:
        raise ValueError("Provide 1 to 80 transaction rows.")
    dictionaries = {dim: {} for dim in DIMENSIONS}
    rows = []
    for record in records:
        if not isinstance(record, dict) or set(record) != {*DIMENSIONS, "sales"}:
            raise ValueError("Each row needs Region, Category, Channel and sales.")
        values = []
        for dim in DIMENSIONS:
            label = record[dim]
            if (not isinstance(label, str) or not 1 <= len(label) <= 24
                    or label == "ALL" or any(ord(char) < 32 for char in label)):
                raise ValueError("Dimension labels need 1 to 24 printable characters; ALL is reserved.")
            dictionary = dictionaries[dim]
            if label not in dictionary:
                dictionary[label] = len(dictionary) + 1
            if len(dictionary) > 6:
                raise ValueError("Each dimension supports at most six distinct values.")
            values.append(dictionary[label])
        sales = finite_number(record["sales"], 0, 1000000)
        rows.append(FactRow(tuple(values), sales, 1))
    results = {}
    for name, algorithm in ALGORITHMS.items():
        started = perf_counter()
        cube = algorithm(rows, DIMENSIONS, support)
        elapsed = (perf_counter() - started) * 1000
        for record in cube:
            for dim in DIMENSIONS:
                if record[dim] != "ALL":
                    record[dim] = next(label for label, code in dictionaries[dim].items() if code == record[dim])
        results[name] = {"rows": cube, "milliseconds": elapsed}
    def normalized(cube):
        return {tuple(row[dim] for dim in DIMENSIONS): (row["total_sales"], row["count_txn"]) for row in cube}
    baseline = normalized(results["Bottom-up"]["rows"])
    for result in results.values():
        actual = normalized(result["rows"])
        result["differences"] = sum(
            1 for key in actual.keys() | baseline.keys()
            if key not in actual or key not in baseline
            or not math.isclose(actual[key][0], baseline[key][0], rel_tol=1e-9, abs_tol=1e-6)
            or actual[key][1] != baseline[key][1])
    return json.dumps({"input_rows": len(rows), "total_sales": sum(row.sales for row in rows),
                       "min_support": support, "results": results}, allow_nan=False)
