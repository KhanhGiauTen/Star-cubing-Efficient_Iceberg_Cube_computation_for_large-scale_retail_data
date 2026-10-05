"""Bottom-up iceberg cube computation for integer-encoded retail transactions."""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List, Sequence, Tuple, Union

from .buc import FactRow

DimensionValue = Union[int, str]


def compute_bottom_up_cube(
    rows: Iterable[FactRow],
    dimension_names: Sequence[str],
    min_sup: float,
) -> List[Dict[str, Union[int, str, float]]]:
    """Compute an iceberg cube by enumerating all cuboids bottom-up.

    For each transaction, all roll-up combinations are generated (``2^d`` with
    ``d`` dimensions). Aggregated rows are then filtered by ``min_sup``.
    """

    materialized_rows = list(rows)
    if not materialized_rows:
        return []

    dim_count = len(dimension_names)
    aggregated: Dict[Tuple[DimensionValue, ...], List[float]] = defaultdict(
        lambda: [0.0, 0.0]
    )

    for row in materialized_rows:
        values = row.dimensions
        for mask in range(1 << dim_count):
            key = tuple(
                values[idx] if (mask & (1 << idx)) else "ALL"
                for idx in range(dim_count)
            )
            aggregated[key][0] += float(row.sales)
            aggregated[key][1] += float(row.count_txn)

    result: List[Dict[str, Union[int, str, float]]] = []
    for key, (total_sales, total_count) in aggregated.items():
        if total_sales < min_sup:
            continue
        record: Dict[str, Union[int, str, float]] = {
            dim_name: key[idx] for idx, dim_name in enumerate(dimension_names)
        }
        record["total_sales"] = float(total_sales)
        record["count_txn"] = int(total_count)
        result.append(record)

    result.sort(key=lambda row: tuple(str(row[dim]) for dim in dimension_names))
    return result


__all__ = ["compute_bottom_up_cube"]
