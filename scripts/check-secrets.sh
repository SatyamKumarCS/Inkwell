#!/usr/bin/env sh
# Fails if any file git would commit (tracked, or untracked and not ignored) contains key material:
# a PEM private key, a service-account JSON private key, or a Resend API key. Part of `pnpm lint`.
cd "$(dirname "$0")/.."

PATTERNS='^-----BEGIN [A-Z ]*PRIVATE KEY-----$|-----BEGIN [A-Z ]*PRIVATE KEY-----\\nMI|re_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}'

if git grep -nIE --untracked "$PATTERNS" -- ':!scripts/check-secrets.sh'; then
  echo "check-secrets: possible secret above. Keep keys in Wrangler secrets or git-ignored files." >&2
  exit 1
fi
echo "check-secrets: no secrets in committed files."
