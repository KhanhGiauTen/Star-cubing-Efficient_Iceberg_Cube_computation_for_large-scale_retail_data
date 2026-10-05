import json
import unittest
from browser_api import run_public

ROWS = [{"Region": "North", "Category": "Books", "Channel": "Web", "sales": 100},
        {"Region": "South", "Category": "Books", "Channel": "Store", "sales": 200}]


class BrowserTests(unittest.TestCase):
    def run_engine(self, rows=ROWS, support=0):
        return json.loads(run_public(json.dumps({"rows": rows, "min_support": support})))

    def test_zero_threshold_agreement_and_grand_total(self):
        result = self.run_engine()
        for algorithm in result["results"].values():
            self.assertEqual(algorithm["differences"], 0)
            total = next(row for row in algorithm["rows"] if all(row[dim] == "ALL" for dim in ("Region", "Category", "Channel")))
            self.assertEqual(total["total_sales"], 300)
            self.assertEqual(total["count_txn"], 2)

    def test_threshold_and_comparison(self):
        result = self.run_engine(support=150)
        self.assertEqual(result["results"]["BUC"]["differences"], 0)
        self.assertEqual(result["results"]["Bottom-up"]["differences"], 0)
        self.assertTrue(all(row["total_sales"] >= 150 for model in result["results"].values() for row in model["rows"]))

    def test_high_threshold_empty_cube(self):
        self.assertTrue(all(not model["rows"] for model in self.run_engine(support=1000)["results"].values()))

    def test_bad_inputs(self):
        for rows, support in [([], 0), (ROWS * 41, 0), (ROWS, -1), (ROWS, True), (ROWS, float("nan")), ([{**ROWS[0], "sales": -1}], 0), ([{**ROWS[0], "Region": "ALL"}], 0)]:
            with self.assertRaises(ValueError):
                self.run_engine(rows, support)


if __name__ == "__main__":
    unittest.main()
