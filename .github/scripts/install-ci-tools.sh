#!/usr/bin/env bash
set -euo pipefail

readonly ACTIONLINT_VERSION="1.7.12"
readonly ACTIONLINT_SHA256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"
readonly SHELLCHECK_VERSION="0.11.0"
readonly SHELLCHECK_SHA256="8c3be12b05d5c177a04c29e3c78ce89ac86f1595681cab149b65b97c4e227198"
readonly YAMLFMT_VERSION="0.21.0"
readonly YAMLFMT_SHA256="1f300d9257b232bb3b541d7fb1b0e6b3c121bcbab381c86cd38cb8722be8a566"

usage() {
  echo "usage: $0 INSTALL_DIR TOOL..." >&2
  echo "tools: actionlint prettier shellcheck yamlfmt" >&2
  exit 2
}

if (($# < 2)); then
  usage
fi

readonly install_dir="$1"
shift

if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "CI tool archives support only Linux x86_64" >&2
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

install_actionlint() {
  local archive="${download_dir}/actionlint.tar.gz"
  download \
    "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz" \
    "$archive" "$ACTIONLINT_SHA256"
  tar -xzf "$archive" -C "$install_dir" actionlint
  chmod 755 "${install_dir}/actionlint"
}

install_prettier() {
  local source_path="${GITHUB_WORKSPACE:-$(pwd)}/.github/node_modules/.bin/prettier"
  if [[ ! -x "$source_path" ]]; then
    echo "Prettier is not installed; run npm ci in .github first" >&2
    exit 1
  fi
  ln -s "$source_path" "${install_dir}/prettier"
}

install_shellcheck() {
  local archive="${download_dir}/shellcheck.tar.xz"
  download \
    "https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/shellcheck-v${SHELLCHECK_VERSION}.linux.x86_64.tar.xz" \
    "$archive" "$SHELLCHECK_SHA256"
  tar -xJf "$archive" --strip-components=1 -C "$install_dir" \
    "shellcheck-v${SHELLCHECK_VERSION}/shellcheck"
  chmod 755 "${install_dir}/shellcheck"
}

install_yamlfmt() {
  local archive="${download_dir}/yamlfmt.tar.gz"
  download \
    "https://github.com/google/yamlfmt/releases/download/v${YAMLFMT_VERSION}/yamlfmt_${YAMLFMT_VERSION}_Linux_x86_64.tar.gz" \
    "$archive" "$YAMLFMT_SHA256"
  tar -xzf "$archive" -C "$install_dir" yamlfmt
  chmod 755 "${install_dir}/yamlfmt"
}

declare -A requested=()
for tool in "$@"; do
  case "$tool" in
    actionlint | prettier | shellcheck | yamlfmt) requested["$tool"]=1 ;;
    *) usage ;;
  esac
done

for tool in actionlint prettier shellcheck yamlfmt; do
  if [[ -n "${requested[$tool]:-}" ]]; then
    "install_${tool}"
  fi
done
