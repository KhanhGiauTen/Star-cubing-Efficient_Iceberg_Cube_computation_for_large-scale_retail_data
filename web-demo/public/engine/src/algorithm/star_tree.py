from __future__ import annotations

from typing import Any, Dict, Iterator, List, Optional, Sequence, Tuple, Union

DimensionValue = Union[int, str]
CuboidRow = Dict[str, Any]


class StarNode:
    """Compact tree node used by the Star-tree.

    The class uses ``__slots__`` to avoid per-instance ``__dict__`` overhead and
    reduce memory usage when the tree grows to millions of nodes.
    """

    __slots__ = ("attr_name", "attr_value", "children", "total_sales", "count_txn")

    def __init__(
        self,
        attr_name: str,
        attr_value: DimensionValue,
        children: Optional[Dict[DimensionValue, "StarNode"]] = None,
        total_sales: float = 0.0,
        count_txn: int = 0,
    ) -> None:
        self.attr_name = attr_name
        self.attr_value = attr_value
        self.children = {} if children is None else children
        self.total_sales = float(total_sales)
        self.count_txn = int(count_txn)


class StarTree:
    """Prefix tree that stores aggregated sales for each dimension path.

    Parameters
    ----------
    dimension_names:
        Optional custom dimension ordering. When omitted, the retail contract
        ordering is used.
    min_sup:
        Minimum total sales threshold used for pruning and star compression.
    """

    DEFAULT_DIMENSIONS: Tuple[str, ...] = (
        "Time_Period",
        "Region",
        "City",
        "Category",
        "Customer_Type",
        "Payment_Method",
    )

    def __init__(
        self,
        dimension_names: Optional[Sequence[str]] = None,
        min_sup: float = 0.0,
    ) -> None:
        self.dimension_names = tuple(dimension_names or self.DEFAULT_DIMENSIONS)
        self.min_sup = float(min_sup)
        self.root = StarNode("ROOT", "ROOT")
        self._low_support_paths: set[Tuple[int, ...]] = set()
        self._global_sales_by_dim: List[Dict[int, float]] = [
            {} for _ in self.dimension_names
        ]

    def insert_transaction(self, transaction: List[int], sales: float, count: int) -> None:
        """Insert one transaction and accumulate its measures along the path.

        The tree stores the sum of ``sales`` and ``count`` on every visited node.
        Global per-dimension totals are updated to support star reduction. If a
        node's cumulative sales falls below ``min_sup``, the corresponding prefix
        is marked for star compression during cube generation.
        """

        values = self._validate_transaction(transaction)
        self._update_global_support(values, sales)

        current = self.root
        current.total_sales += float(sales)
        current.count_txn += int(count)

        prefix: List[int] = []
        for depth, value in enumerate(values):
            child = current.children.get(value)
            if child is None:
                child = StarNode(self.dimension_names[depth], value)
                current.children[value] = child

            child.total_sales += float(sales)
            child.count_txn += int(count)
            prefix.append(int(value))

            prefix_tuple = tuple(prefix)
            if child.total_sales < self.min_sup:
                self._low_support_paths.add(prefix_tuple)
            else:
                self._low_support_paths.discard(prefix_tuple)

            current = child

    def simultaneous_aggregation(self) -> List[CuboidRow]:
        """Generate all valid cuboids with ``total_sales >= min_sup``.

        The method traverses the tree bottom-up through leaf paths. Each leaf is
        expanded into all roll-up combinations, while low-support prefixes and
        low-support dimension values are collapsed to ``'ALL'``.
        """

        aggregated: Dict[Tuple[DimensionValue, ...], CuboidRow] = {}

        for path, leaf_node in self._iter_leaf_nodes(self.root, 0, []):
            if leaf_node.count_txn == 0 and leaf_node.total_sales == 0.0:
                continue

            compressed_path = self._compress_leaf_path(path)
            self._accumulate_cuboids(
                compressed_path,
                leaf_node.total_sales,
                leaf_node.count_txn,
                aggregated,
            )

        valid_rows = [
            row for row in aggregated.values() if row["total_sales"] >= self.min_sup
        ]
        valid_rows.sort(
            key=lambda row: tuple(str(row[dimension]) for dimension in self.dimension_names)
        )
        return valid_rows

    def _validate_transaction(self, transaction: Sequence[int]) -> Tuple[int, ...]:
        """Validate and normalize a transaction into an immutable tuple."""

        if len(transaction) != len(self.dimension_names):
            raise ValueError(
                "transaction length must match the configured dimension count"
            )

        return tuple(int(value) for value in transaction)

    def _update_global_support(self, values: Sequence[int], sales: float) -> None:
        """Update per-dimension global sales totals for star reduction."""

        for index, value in enumerate(values):
            bucket = self._global_sales_by_dim[index]
            bucket[value] = bucket.get(value, 0.0) + float(sales)

    def _is_low_support_value(self, dim_index: int, value: int) -> bool:
        """Check whether a dimension value is globally below ``min_sup``."""

        return self._global_sales_by_dim[dim_index].get(value, 0.0) < self.min_sup

    def _iter_leaf_nodes(
        self,
        node: StarNode,
        depth: int,
        path: List[int],
    ) -> Iterator[Tuple[Tuple[int, ...], StarNode]]:
        """Yield full paths and their leaf nodes in depth-first order."""

        if depth == len(self.dimension_names):
            yield tuple(path), node
            return

        for value, child in sorted(node.children.items(), key=lambda item: str(item[0])):
            path.append(int(value))
            yield from self._iter_leaf_nodes(child, depth + 1, path)
            path.pop()

    def _compress_leaf_path(self, path: Tuple[int, ...]) -> Tuple[DimensionValue, ...]:
        """Apply star compression to a leaf path based on support thresholds."""

        compressed: List[DimensionValue] = list(path)
        prefix: List[int] = []
        skip_prefix_checks = False

        for index, value in enumerate(path):
            prefix.append(int(value))
            low_support_value = self._is_low_support_value(index, int(value))
            low_support_prefix = (
                not skip_prefix_checks and tuple(prefix) in self._low_support_paths
            )
            if low_support_value or low_support_prefix:
                compressed[index] = "ALL"
                skip_prefix_checks = True

        return tuple(compressed)

    def _accumulate_cuboids(
        self,
        values: Tuple[DimensionValue, ...],
        sales: float,
        count_txn: int,
        aggregated: Dict[Tuple[DimensionValue, ...], CuboidRow],
    ) -> None:
        """Expand one compressed path into all roll-up combinations."""

        concrete_positions = [
            index for index, value in enumerate(values) if value != "ALL"
        ]

        for mask in range(1 << len(concrete_positions)):
            rolled_up_values = list(values)
            for bit_index, position in enumerate(concrete_positions):
                if mask & (1 << bit_index):
                    continue
                rolled_up_values[position] = "ALL"

            key = tuple(rolled_up_values)
            row = aggregated.get(key)
            if row is None:
                row = {
                    dimension: rolled_up_values[index]
                    for index, dimension in enumerate(self.dimension_names)
                }
                row["total_sales"] = 0.0
                row["count_txn"] = 0
                aggregated[key] = row

            row["total_sales"] += float(sales)
            row["count_txn"] += int(count_txn)


__all__ = ["CuboidRow", "DimensionValue", "StarNode", "StarTree"]