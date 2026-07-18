#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -eq 0 ]]; then
  echo "Usage: scripts/notarize-staple.sh <artifact.dmg|artifact.pkg>..." >&2
  exit 1
fi

notary_args=()
if [[ -n "${APPLE_API_KEY_PATH:-}" && -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_ISSUER:-}" ]]; then
  notary_args=(--key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER")
elif [[ -n "${APPLE_ID:-}" && -n "${APPLE_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]; then
  notary_args=(--apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID")
else
  echo "Apple notarization credentials are not set; skipping notarization."
  exit 0
fi

for artifact in "$@"; do
  if [[ ! -f "$artifact" ]]; then
    echo "Artifact not found: $artifact" >&2
    exit 1
  fi
  echo "Submitting $(basename "$artifact") for notarization..."
  xcrun notarytool submit "$artifact" "${notary_args[@]}" --wait
  echo "Stapling $(basename "$artifact")..."
  xcrun stapler staple "$artifact"
done
