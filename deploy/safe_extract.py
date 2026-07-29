#!/usr/bin/env python3
import os
import stat
import sys
import zipfile
from pathlib import Path, PurePosixPath

MAX_ENTRIES = 1_000
MAX_FILE_SIZE = 64 * 1024 * 1024
MAX_TOTAL_SIZE = 128 * 1024 * 1024


def fail(message):
    raise SystemExit(message)


if len(sys.argv) != 3:
    fail("Usage: safe_extract.py ARCHIVE DESTINATION")

archive = Path(sys.argv[1])
destination = Path(sys.argv[2]).resolve(strict=True)
if archive.is_symlink() or not archive.is_file():
    fail(f"Unsafe archive: {archive}")

with zipfile.ZipFile(archive) as source:
    entries = source.infolist()
    if not entries or len(entries) > MAX_ENTRIES:
        fail("ZIP has invalid entry count")

    total_size = 0
    seen = set()
    validated = []
    for entry in entries:
        raw_name = entry.filename
        path = PurePosixPath(raw_name)
        mode = entry.external_attr >> 16
        file_type = stat.S_IFMT(mode)
        is_directory = entry.is_dir()

        if not raw_name or "\\" in raw_name or path.is_absolute() or ".." in path.parts:
            fail(f"Unsafe ZIP entry: {raw_name}")
        normalized = path.as_posix().rstrip("/")
        if not normalized or normalized in seen:
            fail(f"Duplicate ZIP entry: {raw_name}")
        seen.add(normalized)
        if file_type and not (is_directory and file_type == stat.S_IFDIR) and not (
            not is_directory and file_type == stat.S_IFREG
        ):
            fail(f"Non-regular ZIP entry: {raw_name}")
        if entry.file_size > MAX_FILE_SIZE:
            fail(f"ZIP entry too large: {raw_name}")
        total_size += entry.file_size
        if total_size > MAX_TOTAL_SIZE:
            fail("ZIP expands beyond size limit")

        target = (destination / normalized).resolve(strict=False)
        if destination != target and destination not in target.parents:
            fail(f"ZIP entry escapes destination: {raw_name}")
        validated.append((entry, target, is_directory))

    for entry, target, is_directory in validated:
        if is_directory:
            target.mkdir(parents=True, exist_ok=True, mode=0o755)
            os.chmod(target, 0o755)
            continue
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
        if target.exists() or target.is_symlink():
            fail(f"ZIP entry collides with existing file: {entry.filename}")
        with source.open(entry) as reader, target.open("xb") as writer:
            while chunk := reader.read(1024 * 1024):
                writer.write(chunk)
        os.chmod(target, 0o644)

for path in destination.rglob("*"):
    if path.is_symlink():
        fail(f"Symlink appeared during extraction: {path}")
    if path.is_dir():
        os.chmod(path, 0o755)
    elif path.is_file():
        os.chmod(path, 0o644)
    else:
        fail(f"Special file appeared during extraction: {path}")
