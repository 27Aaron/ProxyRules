#!/usr/bin/env bash
set -euo pipefail

if (($# != 3)); then
  echo "usage: $0 OUTPUT_DIR PREPARED_METADATA CONFIG" >&2
  exit 2
fi

readonly output_dir="$1"
readonly metadata_path="$2"
readonly config_path="$3"
readonly manifest_path="${output_dir}/manifest.json"
readonly checksums_path="${output_dir}/SHA256SUMS"

for required_path in \
  "$output_dir" "$metadata_path" "$config_path" \
  "$manifest_path" "$checksums_path"; do
  if [[ ! -e "$required_path" || -L "$required_path" ]]; then
    echo "required validation input is missing or symbolic: $required_path" >&2
    exit 1
  fi
done

if [[ ! -d "$output_dir" ]]; then
  echo "generated output is not a directory: $output_dir" >&2
  exit 1
fi
if [[ -n "$(find "$output_dir" -type l -print -quit)" ]]; then
  echo "generated output contains a symbolic link" >&2
  exit 1
fi
if [[ -n "$(find "$output_dir" -type f -iname 'README*' -print -quit)" ]]; then
  echo "generated output contains a README" >&2
  exit 1
fi

(
  cd "$output_dir"
  sha256sum --check --strict --quiet SHA256SUMS
)

jq -e \
  --slurpfile config "$config_path" \
  --slurpfile prepared "$metadata_path" '
  . as $manifest |
  $config[0] as $config |
  $prepared[0] as $prepared |
  ($manifest.collections.geosite.categories | keys) as $geosite |
  ($manifest.collections.geoip.categories | keys) as $geoip |
  (($geosite + $geoip) | unique | sort) as $default_rulesets |
  ([
    $manifest.collections.ruleset.categories | to_entries[] |
    select((.value.action // "default") == "default") | .key
  ] | sort) as $published_defaults |
  ([
    $prepared.rulesets[] |
    select((.action // "default") != "default")
  ] | length) as $action_groups |

  $manifest.schema_version == 2 and
  $manifest.mode == "category-first" and
  ($manifest.sources | keys == ["custom", "geoip", "geosite"]) and
  ($manifest.collections | keys == ["geoip", "geosite", "ruleset"]) and
  ($prepared.aliases == $config.aliases) and
  ($prepared.categories | length) >= $config.minimum_categories.custom and
  all($config.required_categories.custom[]; . as $category |
    $prepared.categories | has($category)) and

  all(["geosite", "geoip", "ruleset"][]; . as $collection |
    ($manifest.collections[$collection].path == $collection) and
    (($manifest.collections[$collection].categories | length) >=
      $config.minimum_categories[$collection]) and
    all($config.required_categories[$collection][]; . as $category |
      $manifest.collections[$collection].categories | has($category)) and
    ($manifest.collections[$collection].statistics.generated_categories ==
      ($manifest.collections[$collection].categories | length))
  ) and

  ($manifest.collections.geosite.sources == ["geosite", "custom"]) and
  ($manifest.collections.geoip.sources == ["geoip", "custom"]) and
  ($manifest.collections.ruleset.sources == ["geosite", "geoip", "custom"]) and
  all($manifest.collections.geosite.categories[];
    (.formats | keys == ["list", "mrs", "srs", "yaml"]) and
    all(.formats[]; (.rules >= 0) and
      (.counts | type == "object") and (.omitted | type == "object"))
  ) and
  all($manifest.collections.geoip.categories[];
    (.formats | keys == ["list", "mrs", "srs", "yaml"]) and
    all(.formats[]; (.rules >= 0) and
      (.counts | type == "object") and (.omitted | type == "object"))
  ) and
  all($manifest.collections.ruleset.categories[];
    (.formats | keys == ["list", "srs", "yaml"]) and
    all(.formats[]; (.rules >= 0) and
      (.counts | type == "object") and (.omitted | type == "object"))
  ) and

  ($published_defaults == $default_rulesets) and
  (($manifest.collections.ruleset.categories | keys) ==
    ($prepared.rulesets | keys)) and
  all($prepared.rulesets | to_entries[]; . as $ruleset |
    (($manifest.collections.ruleset.categories[$ruleset.key].action // "default") ==
      ($ruleset.value.action // "default")) and
    ($manifest.collections.ruleset.categories[$ruleset.key].path ==
      ("ruleset/" + $ruleset.value.output_directory))
  ) and
  all($prepared.categories | keys[]; . as $category |
    ($manifest.collections.geosite.categories | has($category)) and
    ($manifest.collections.geoip.categories | has($category)) and
    ($published_defaults | index($category) != null)
  ) and
  ($manifest.collections.ruleset.statistics.default_categories ==
    ($default_rulesets | length)) and
  ($manifest.collections.ruleset.statistics.action_groups == $action_groups) and
  ($manifest.collections.ruleset.statistics.generated_categories ==
    ($manifest.collections.ruleset.categories | length)) and
  ($manifest.collections.ruleset.unsupported_formats.mrs.reason | length > 0)
' "$manifest_path" > /dev/null

while IFS=$'\t' read -r relative expected_sha256; do
  case "$relative" in
    "" | /* | ../* | */../* | */..) echo "unsafe manifest path: $relative" >&2; exit 1 ;;
  esac
  generated_path="${output_dir}/${relative}"
  if [[ ! -s "$generated_path" || -L "$generated_path" ]]; then
    echo "generated file is missing, empty, or symbolic: $relative" >&2
    exit 1
  fi
  actual_sha256="$(sha256sum "$generated_path" | cut -d ' ' -f 1)"
  if [[ "$actual_sha256" != "$expected_sha256" ]]; then
    echo "manifest checksum mismatch: $relative" >&2
    exit 1
  fi
done < <(
  jq -r '
    .collections[].categories[].formats[] |
    [.path, .sha256] | @tsv
  ' "$manifest_path"
)

manifest_files="$({
  echo manifest.json
  jq -r '.collections[].categories[].formats[].path' "$manifest_path"
} | sort)"
checksum_files="$(sed -E 's/^[0-9a-f]{64}  //' "$checksums_path" | sort)"
if [[ "$manifest_files" != "$checksum_files" ]]; then
  echo "manifest paths disagree with SHA256SUMS" >&2
  exit 1
fi

actual_files="$(
  find "$output_dir" -type f -print |
    while IFS= read -r generated_path; do
      printf '%s\n' "${generated_path#"${output_dir}/"}"
    done |
    sort
)"
published_files="$({
  echo SHA256SUMS
  printf '%s\n' "$checksum_files"
} | sort)"
if [[ "$actual_files" != "$published_files" ]]; then
  echo "generated output contains an untracked or missing file" >&2
  exit 1
fi

echo "generated rules validation passed"
