#!/usr/bin/env python3
import hashlib
import json
import re
import sys
from pathlib import Path


def fail(message):
    raise SystemExit(message)


write_manifest = len(sys.argv) == 3 and sys.argv[1] == "--write"
verify_metadata = len(sys.argv) == 4
if len(sys.argv) != 2 and not write_manifest and not verify_metadata:
    fail("Usage: verify_release.py [--write] RELEASE_DIR [DEPLOY_ID SHA256]")

release_argument = sys.argv[2] if write_manifest else sys.argv[1]
release = Path(release_argument).resolve(strict=True)
manifest = release / "manifest.sha256"
if write_manifest:
    lines = []
    for path in sorted(release.rglob("*")):
        if path.is_symlink() or not (path.is_dir() or path.is_file()):
            fail(f"Unsafe release entry: {path}")
        if path.is_file() and path != manifest:
            relative = path.relative_to(release).as_posix()
            if not re.fullmatch(r"[A-Za-z0-9._/-]+", relative):
                fail(f"Unsafe release path: {relative}")
            lines.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {relative}")
    manifest.write_text("\n".join(lines) + "\n", encoding="ascii")

if manifest.is_symlink() or not manifest.is_file():
    fail("Release manifest missing")

expected = {}
for line in manifest.read_text(encoding="ascii").splitlines():
    match = re.fullmatch(r"([a-f0-9]{64})  ([A-Za-z0-9._/-]+)", line)
    if not match or match.group(2) == "manifest.sha256" or match.group(2) in expected:
        fail("Invalid release manifest")
    expected[match.group(2)] = match.group(1)

actual = set()
for path in release.rglob("*"):
    if path.is_symlink() or not (path.is_dir() or path.is_file()):
        fail(f"Unsafe release entry: {path}")
    if path.is_file():
        relative = path.relative_to(release).as_posix()
        if relative != "manifest.sha256":
            actual.add(relative)

if not expected or actual != set(expected):
    fail("Release files do not match manifest")

for relative, digest in expected.items():
    hasher = hashlib.sha256()
    with (release / relative).open("rb") as source:
        while chunk := source.read(1024 * 1024):
            hasher.update(chunk)
    if hasher.hexdigest() != digest:
        fail(f"Release hash mismatch: {relative}")

if verify_metadata:
    deployment_id, expected_sha = sys.argv[2:4]
    metadata_path = release / "release.json"
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        fail("Invalid release metadata")
    if metadata.get("deployment") != deployment_id or not re.fullmatch(r"[a-f0-9]{40}", metadata.get("commit", "")):
        fail("Release metadata does not match deployment")
    bundle = release / f"v1/deployments/{deployment_id}/sha256/{expected_sha}/player.min.js"
    if not bundle.is_file():
        fail("Release metadata bundle missing")

print("Release manifest verified.")
