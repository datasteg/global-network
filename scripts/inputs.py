"""inputs.py — a fingerprint of everything scripts/build.py reads, so a rebuild can be skipped when nothing it reads has changed.

  python3 scripts/inputs.py            # prints a 16-hex fingerprint
  python3 scripts/inputs.py --list     # prints each input with its own hash, then the fingerprint

The inputs are the ones build.py records under `inputs` in its build log (keep the two lists in step):
  money-flow   $MONEY_FLOW_SITE/surface.json (its release tag names an immutable release folder) and the two tables
               build.py reads, links.parquet and signals.parquet (rebuilt between releases)
  trade-flow   ../trade-flow/data/surface.json and every file matching the patterns its `files` list names
  config       config/shocks.yaml, config/regions.yaml, config/stress.yaml and ../trade-flow/config/events.yaml
  registry     ../family/measures.json, the measures registry (names partner 490's node, asia_nes)
The site's own code is not part of it. Standard library only,
so it runs before the build without uv. Same environment variables as build.py.
"""
import fnmatch
import hashlib
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
MF_SITE = Path(os.environ.get("MONEY_FLOW_SITE", "/data/money-flow/site"))
MF_TABLES = Path(os.environ.get("MONEY_FLOW_TABLES", "/data/money-flow/tables"))
TF = Path(os.environ.get("TRADE_FLOW_DIR", HERE.parent / "trade-flow"))
TF_DATA = TF / "data"


def sha(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def tf_files() -> list[Path]:
    """trade-flow's data files that its surface lists: 'snap/W/*' is matched with a brotli suffix or without one."""
    pats = json.loads((TF_DATA / "surface.json").read_text()).get("files") or []
    out = []
    for d, _, files in os.walk(TF_DATA):
        for f in files:
            p = Path(d) / f
            rel = p.relative_to(TF_DATA).as_posix()
            bare = rel[:-3] if rel.endswith(".br") else rel
            if any(fnmatch.fnmatchcase(bare, pat) or fnmatch.fnmatchcase(rel, pat) for pat in pats):
                out.append(p)
    return sorted(out)


def inputs() -> list[Path]:
    paths = [MF_SITE / "surface.json", MF_TABLES / "links.parquet", MF_TABLES / "signals.parquet",
             TF_DATA / "surface.json", *tf_files(),
             HERE / "config" / "shocks.yaml", HERE / "config" / "regions.yaml", HERE / "config" / "stress.yaml",
             TF / "config" / "events.yaml", HERE.parent / "family" / "measures.json"]
    missing = [str(p) for p in paths if not p.is_file()]
    if missing:
        sys.exit(f"inputs.py: missing input(s): {', '.join(missing)}")
    return paths


def main() -> None:
    rows = [(str(p), sha(p)) for p in inputs()]
    fp = hashlib.sha256("\n".join(f"{p}\t{h}" for p, h in rows).encode()).hexdigest()[:16]
    if "--list" in sys.argv[1:]:
        for p, h in rows:
            print(f"{h[:16]}  {p}")
        print(f"{len(rows)} inputs")
    print(fp)


if __name__ == "__main__":
    main()
