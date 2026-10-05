#!/usr/bin/env python3
"""
Thin wrapper exposing the two scriptable steps of the qa-ai-flow pipeline
(Step 1 — generate, Step 2 — upload/sync) under one discoverable command.
Step 3 (Playwright automation) is skill-only — see
the playwright-from-testcases skill — and has no
script to wrap here.

Usage:
  python3 run.py generate --schema-root . --out ...
  python3 run.py upload --dry-run
  python3 run.py sync-results --results ...

All flags after the subcommand are forwarded verbatim to the underlying
script — run `python3 run.py <subcommand> --help` to see them.
"""
import argparse
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))

SCRIPTS = {
    "generate": os.path.join(ROOT, "01-test-case-generator", "strapi_generate_testcases_v2.py"),
    "upload": os.path.join(ROOT, "02-notion-test-case-uploader", "upload_testcases_to_notion.py"),
    "sync-results": os.path.join(ROOT, "02-notion-test-case-uploader", "update_test_results.py"),
}

def main():
    parser = argparse.ArgumentParser(
        description="qa-ai-flow — unified entry point for Step 1 (generate) and Step 2 (upload/sync-results).",
        usage="run.py {generate,upload,sync-results} [args...]",
    )
    parser.add_argument("subcommand", choices=SCRIPTS.keys())
    parser.add_argument("args", nargs=argparse.REMAINDER)
    parsed = parser.parse_args()

    script = SCRIPTS[parsed.subcommand]
    # Run from the script's own directory so its default relative paths
    # (e.g. the generate/upload scripts' ../testcases.json) resolve the
    # same way as running it directly.
    cwd = os.path.dirname(script)
    result = subprocess.run([sys.executable, script, *parsed.args], cwd=cwd)
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
