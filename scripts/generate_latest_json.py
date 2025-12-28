#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
自动生成 Tauri latest.json（放在 nsis 目录）
—— 版本感知：只匹配当前 version 对应的 exe / sig
"""

import json
import datetime as dt
from pathlib import Path
import argparse
import sys


# ========= 只需配置一次 =========
GITHUB_USER = "LonelyPower"
GITHUB_REPO = "lpe-reminder"
PLATFORM_KEY = "windows-x86_64"
# =================================


def rfc3339():
    return (
        dt.datetime.now(dt.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def find_nsis_dir() -> Path:
    base = Path("src-tauri/target/release/bundle/nsis")
    if not base.exists():
        sys.exit(f"[ERROR] 未找到目录: {base}")
    return base


def find_exact(pattern: str, base: Path) -> Path:
    matches = list(base.glob(pattern))
    if not matches:
        sys.exit(f"[ERROR] 未找到匹配文件: {pattern}")
    if len(matches) > 1:
        names = ", ".join(m.name for m in matches)
        sys.exit(f"[ERROR] 发现多个匹配（版本是否写错？）: {names}")
    return matches[0]


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument("--version", required=True, help="版本号，例如 1.0.1")
    parser.add_argument("--notes", default="", help="更新说明（可选）")

    args = parser.parse_args()

    nsis_dir = find_nsis_dir()

    exe_pattern = f"*_{args.version}_*setup.exe"
    sig_pattern = f"*_{args.version}_*.exe.sig"

    exe_file = find_exact(exe_pattern, nsis_dir)
    sig_file = find_exact(sig_pattern, nsis_dir)

    signature = sig_file.read_text(encoding="utf-8").strip()

    # GitHub Releases URL
    url = (
        f"https://github.com/{GITHUB_USER}/{GITHUB_REPO}"
        f"/releases/download/v{args.version}/{exe_file.name}"
    )

    latest = {
        "version": args.version,
        "notes": args.notes,
        "pub_date": rfc3339(),
        "platforms": {
            PLATFORM_KEY: {
                "signature": signature,
                "url": url,
            }
        },
    }

    out = nsis_dir / "latest.json"
    out.write_text(json.dumps(latest, indent=2, ensure_ascii=False), "utf-8")

    print(f"[OK] 已生成: {out}")
    print(json.dumps(latest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
