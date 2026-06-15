"""
embed_trajectories.py
=====================
Re-embeds docs/demo_trajectories.json into docs/index.html
as the TRAJ_DATA JavaScript constant.

Run this from the project root whenever you regenerate demo_trajectories.json:

    python scripts/embed_trajectories.py

Or with custom paths:

    python scripts/embed_trajectories.py \
        --json path/to/demo_trajectories.json \
        --html docs/index.html
"""

import argparse
import json
import re
import sys
from pathlib import Path


def embed(json_path: Path, html_path: Path) -> None:
    if not json_path.exists():
        sys.exit(f"[embed] JSON not found: {json_path}")
    if not html_path.exists():
        sys.exit(f"[embed] HTML not found: {html_path}")

    with open(json_path) as f:
        data = json.load(f)

    compact = json.dumps(data, separators=(",", ":"))

    with open(html_path) as f:
        html = f.read()

    # Replace the TRAJ_DATA constant — matches everything between
    # "const TRAJ_DATA = " and the first "};" at the top level
    pattern = r'(const TRAJ_DATA = )\{.*?\}(?=;)'
    substituted = [0]
    def replace(m):
        substituted[0] += 1
        return m.group(1) + compact
    new_html = re.sub(pattern, replace, html, count=1, flags=re.DOTALL)
    count = substituted[0]
    if count == 0:
        sys.exit("[embed] Could not find TRAJ_DATA constant in HTML. "
                 "Make sure docs/index.html contains 'const TRAJ_DATA = {...};'")

    with open(html_path, "w") as f:
        f.write(new_html)

    n_examples = len(data.get("examples", []))
    size_kb = json_path.stat().st_size / 1024
    print(f"[embed] Embedded {n_examples} examples ({size_kb:.1f} KB) → {html_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Embed demo_trajectories.json into index.html"
    )
    parser.add_argument(
        "--json",
        default="docs/demo_trajectories.json",
        help="Path to demo_trajectories.json (default: docs/demo_trajectories.json)",
    )
    parser.add_argument(
        "--html",
        default="docs/index.html",
        help="Path to index.html (default: docs/index.html)",
    )
    args = parser.parse_args()
    embed(Path(args.json), Path(args.html))


if __name__ == "__main__":
    main()
