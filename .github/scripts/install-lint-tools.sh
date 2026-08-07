#!/usr/bin/env bash
set -euo pipefail

readonly ACTIONLINT_VERSION="1.7.12"
readonly ACTIONLINT_SHA256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"
readonly SHELLCHECK_VERSION="0.11.0"
readonly SHELLCHECK_SHA256="8c3be12b05d5c177a04c29e3c78ce89ac86f1595681cab149b65b97c4e227198"

if (($# != 1)); then
  echo "usage: $0 INSTALL_DIR" >&2
  exit 2
fi

readonly install_dir="$1"

if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "lint tool archives support only Linux x86_64" >&2
  exit 1
fi

mkdir -p "$install_dir"
download_dir="$(mktemp -d)"
trap 'rm -rf "$download_dir"' EXIT

download() {
  local url="$1"
  local destination="$2"
  local sha256="$3"

  curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
    --retry 3 --retry-all-errors \
    --output "$destination" "$url"
  echo "${sha256}  ${destination}" | sha256sum --check --strict --quiet -
}

actionlint_archive="${download_dir}/actionlint.tar.gz"
download \
  "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz" \
  "$actionlint_archive" "$ACTIONLINT_SHA256"
tar -xzf "$actionlint_archive" -C "$install_dir" actionlint
chmod 755 "${install_dir}/actionlint"

shellcheck_archive="${download_dir}/shellcheck.tar.xz"
download \
  "https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/shellcheck-v${SHELLCHECK_VERSION}.linux.x86_64.tar.xz" \
  "$shellcheck_archive" "$SHELLCHECK_SHA256"
tar -xJf "$shellcheck_archive" --strip-components=1 -C "$install_dir" \
  "shellcheck-v${SHELLCHECK_VERSION}/shellcheck"
chmod 755 "${install_dir}/shellcheck"
