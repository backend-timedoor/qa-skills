#!/usr/bin/env python3
"""
Thin wrapper exposing the scriptable Notion steps of the qa-ai-flow pipeline
(upload and result sync) under one discoverable command. Test-case
generation and Playwright automation are skill-only.

Usage:
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
    "upload": os.path.join(ROOT, "upload_testcases_to_notion.py"),
    "sync-results": os.path.join(ROOT, "update_test_results.py"),
}

def main():
    parser = argparse.ArgumentParser(
        description="qa-ai-flow — entry point for the Notion upload and result-sync scripts.",
        usage="run.py {upload,sync-results} [args...]",
    )
    parser.add_argument("subcommand", choices=SCRIPTS.keys())
    parser.add_argument("args", nargs=argparse.REMAINDER)
    parsed = parser.parse_args()

    script = SCRIPTS[parsed.subcommand]
    # Run from the caller's directory (the project root) so .env and the
    # default relative paths (testcases.json, e2e/tests) resolve there.
    cwd = os.getcwd()
    result = subprocess.run([sys.executable, script, *parsed.args], cwd=cwd)
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
