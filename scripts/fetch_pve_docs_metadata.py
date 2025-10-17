#!/usr/bin/env python3
"""Fetch metadata about the published Proxmox VE API documentation."""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from typing import Any, Dict

DEFAULT_URL = "https://pve.proxmox.com/pve-docs/"


def collapse_html_whitespace(value: str) -> str:
    """Collapse whitespace and strip HTML tags from a snippet."""
    text = re.sub(r"<[^>]+>", " ", value)
    text = text.replace("&nbsp;", " ")
    text = " ".join(text.split())
    return text


def extract_metadata(html: str) -> Dict[str, str]:
    """Parse the HTML blob and return version metadata if available."""
    metadata: Dict[str, str] = {}
    text = collapse_html_whitespace(html)

    version_match = re.search(r"Version\s+([0-9]+(?:\.[0-9]+)*)", text)
    if version_match:
        metadata["version"] = version_match.group(1)

    updated_match = re.search(
        r"Last updated\s+([A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\S+\s+\d{4})",
        text,
    )
    if updated_match:
        metadata["updated_at"] = " ".join(updated_match.group(1).split())

    return metadata


def fetch_metadata(url: str) -> Dict[str, Any]:
    """Fetch the HTML page and return structured metadata."""
    data: Dict[str, Any] = {}
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            html = response.read().decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError) as exc:  # pragma: no cover - network failure path
        data["error"] = str(exc)
        return data

    data.update(extract_metadata(html))
    return data


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=DEFAULT_URL, help="Documentation index URL to scrape")
    parser.add_argument("--output", help="Optional path to write the metadata JSON")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    payload = fetch_metadata(args.url)
    output = json.dumps(payload)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            handle.write(output)
            handle.write("\n")
    else:
        sys.stdout.write(output)
        sys.stdout.write("\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
