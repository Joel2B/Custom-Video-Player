#!/usr/bin/env python3
import stat
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


extractor = Path(__file__).with_name("safe_extract.py")


def archive(path, entries):
    with zipfile.ZipFile(path, "w") as output:
        for name, content, symlink in entries:
            info = zipfile.ZipInfo(name)
            if symlink:
                info.create_system = 3
                info.external_attr = (stat.S_IFLNK | 0o777) << 16
            output.writestr(info, content)


def extract(path, destination):
    return subprocess.run(
        [sys.executable, str(extractor), str(path), str(destination)],
        check=False,
        capture_output=True,
        text=True,
    )


with tempfile.TemporaryDirectory(prefix="cvp-extract-") as root_name:
    root = Path(root_name)
    output = root / "output"
    output.mkdir()
    safe = root / "safe.zip"
    archive(safe, [("nested/player.min.js", "bundle", False)])
    result = extract(safe, output)
    assert result.returncode == 0, result.stderr
    assert (output / "nested/player.min.js").read_text() == "bundle"

for name, entries in (
    ("traversal", [("../escape.js", "bad", False)]),
    ("symlink", [("leak.js", "/etc/passwd", True)]),
    ("duplicate", [("same.js", "one", False), ("same.js", "two", False)]),
):
    with tempfile.TemporaryDirectory(prefix="cvp-extract-") as root_name:
        root = Path(root_name)
        output = root / "output"
        output.mkdir()
        unsafe = root / f"{name}.zip"
        archive(unsafe, entries)
        result = extract(unsafe, output)
        assert result.returncode != 0, f"{name} ZIP was accepted"

print("Safe extractor tests passed.")
