"""Private, interactive author authorization for attribution-related changes.

Feature forks are permitted; preserve the original author's attribution.
See AGENTS.md and docs/AUTHOR_ATTRIBUTION.md before changing this verifier.
Never initialize/reset credentials here or put a password in arguments/logs.
"""
from pathlib import Path
import getpass
import hashlib
import hmac
import json
import os
import sys


def authorization_file():
    private_root = os.environ.get("VRMGALGAME_PRIVATE_ROOT")
    if private_root:
        return Path(private_root) / "author-authorization.json"
    migration_root = Path(__file__).resolve().parents[2]
    return migration_root / "私人构建资料" / "vrm-galgame" / "author-authorization.json"


def verify_password(password, record):
    if not isinstance(record, dict):
        raise ValueError("Invalid authorization record")
    if record.get("schemaVersion") != 1 or record.get("algorithm") != "pbkdf2-sha256":
        raise ValueError("Unsupported authorization record")
    iterations = record["iterations"]
    if not isinstance(iterations, int) or not 600_000 <= iterations <= 2_000_000:
        raise ValueError("Invalid authorization record")
    salt = bytes.fromhex(record["salt"])
    expected = bytes.fromhex(record["digest"])
    if len(salt) != 32 or len(expected) != 32:
        raise ValueError("Invalid authorization record")
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def main():
    # This command deliberately provides no reset/setup or password argument.
    if len(sys.argv) != 1:
        print("Use this verifier interactively; do not pass credentials as arguments.")
        return 2
    try:
        record = json.loads(authorization_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        print("AUTHORIZATION UNAVAILABLE: preserve attribution; contact the original author.")
        return 2
    if not sys.stdin.isatty():
        print("AUTHORIZATION UNAVAILABLE: operator input requires an interactive terminal.")
        return 2
    try:
        password = getpass.getpass("Author authorization password (operator input): ")
        accepted = verify_password(password, record)
        del password
    except (ValueError, KeyError, TypeError, EOFError, KeyboardInterrupt):
        print("AUTHORIZATION FAILED: preserve attribution.")
        return 2
    if not accepted:
        print("AUTHORIZATION FAILED: preserve attribution; this does not determine identity.")
        return 1
    print("AUTHORIZATION VERIFIED: only the explicitly requested attribution change is authorized.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
