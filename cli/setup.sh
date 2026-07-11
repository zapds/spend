#!/usr/bin/env bash
set -euo pipefail

BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

cargo build --release

mkdir -p "$BIN_DIR"
cp target/release/spend "$BIN_DIR/spend"
chmod 755 "$BIN_DIR/spend"

case ":$PATH:" in
    *":$BIN_DIR:"*)
        ;;
    *)
        printf 'Installed spend to %s\n' "$BIN_DIR/spend"
        printf 'Warning: %s is not currently in PATH. Add it to your shell profile to run spend directly.\n' "$BIN_DIR"
        exit 0
        ;;
esac

printf 'Installed spend to %s\n' "$BIN_DIR/spend"
printf 'Run: spend --help\n'
