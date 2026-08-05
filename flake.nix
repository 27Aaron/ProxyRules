{
  description = "ProxyRules — format tooling (nix fmt)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = {
    self,
    nixpkgs,
  }: let
    systems = [
      "aarch64-darwin"
      "x86_64-darwin"
      "aarch64-linux"
      "x86_64-linux"
    ];
    forAllSystems = nixpkgs.lib.genAttrs systems;
    pkgsFor = system: nixpkgs.legacyPackages.${system};

    # Pure shell (no Python): rewrite Rules/*.list & *.yaml headers
    mkUpdateRuleHeaders = pkgs:
      pkgs.writeShellApplication {
        name = "update-rule-headers";
        runtimeInputs = with pkgs; [
          bash
          coreutils
          findutils
          git
          gawk
        ];
        text = ''
          set -euo pipefail

          AUTHOR="27Aaron"
          REPO="https://github.com/27Aaron/ProxyRules"
          UPDATED="$(date '+%Y-%m-%d %H:%M:%S')"

          root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
          cd "$root"

          is_meta_header() {
            local line="$1"
            case "$line" in
              "# NAME:"*|"# AUTHOR:"*|"# REPO:"*|"# UPDATED:"*|"# TOTAL:"*) return 0 ;;
            esac
            # "# DOMAIN: 12" style count lines
            if [[ "$line" =~ ^#\ [A-Z][A-Z0-9-]*:\ [0-9]+$ ]]; then
              return 0
            fi
            return 1
          }

          # Write body (without old header) to $1; print counts as TYPE=N lines on fd3
          extract_body_and_count() {
            local src="$1" body="$2"
            : >"$body"
            local past=0 line s typ
            # types we care about (order for header output)
            local -a order=(
              DOMAIN DOMAIN-SUFFIX DOMAIN-KEYWORD DOMAIN-WILDCARD
              IP-CIDR IP-CIDR6 GEOIP IP-ASN PROCESS-NAME
              URL-REGEX USER-AGENT SRC-IP DEST-PORT PROTOCOL
            )
            local -A counts=()
            local total=0

            while IFS= read -r line || [[ -n "$line" ]]; do
              if [[ "$past" -eq 0 ]]; then
                if [[ -z "$line" ]]; then
                  continue
                fi
                if is_meta_header "$line"; then
                  continue
                fi
                past=1
              fi
              printf '%s\n' "$line" >>"$body"

              s="$line"
              # trim leading space
              s="''${s#"''${s%%[![:space:]]*}"}"
              # yaml list item: "- DOMAIN,..."
              if [[ "$s" == "- "* ]]; then
                s="''${s#- }"
              elif [[ "$s" == -* ]]; then
                s="''${s#-}"
                s="''${s#"''${s%%[![:space:]]*}"}"
              fi
              [[ -z "$s" || "$s" == \#* || "$s" == "payload:" ]] && continue

              typ="''${s%%,*}"
              typ="''${typ%"''${typ##*[![:space:]]}"}"
              case "$typ" in
                DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|DOMAIN-WILDCARD|IP-CIDR|IP-CIDR6|GEOIP|IP-ASN|PROCESS-NAME|URL-REGEX|USER-AGENT|SRC-IP|DEST-PORT|PROTOCOL)
                  counts["$typ"]=$((''${counts[$typ]:-0} + 1))
                  total=$((total + 1))
                  ;;
              esac
            done <"$src"

            local t
            for t in "''${order[@]}"; do
              if [[ -n "''${counts[$t]:-}" ]]; then
                printf '%s=%s\n' "$t" "''${counts[$t]}"
              fi
            done
            printf 'TOTAL=%s\n' "$total"
          }

          process_file() {
            local f="$1"
            [[ -f "$f" ]] || {
              echo "skip missing: $f" >&2
              return 0
            }

            local name base body out counts_file
            base="$(basename "$f")"
            name="''${base%.*}"
            body="$(mktemp)"
            out="$(mktemp)"
            counts_file="$(mktemp)"

            extract_body_and_count "$f" "$body" >"$counts_file"

            {
              echo "# NAME: $name"
              echo "# AUTHOR: $AUTHOR"
              echo "# REPO: $REPO"
              echo "# UPDATED: $UPDATED"
              local line key val
              while IFS= read -r line || [[ -n "$line" ]]; do
                [[ -z "$line" ]] && continue
                key="''${line%%=*}"
                val="''${line#*=}"
                if [[ "$key" == "TOTAL" ]]; then
                  echo "# TOTAL: $val"
                else
                  echo "# $key: $val"
                fi
              done <"$counts_file"
              echo
              # body (may be empty)
              if [[ -s "$body" ]]; then
                cat "$body"
                # ensure trailing newline
                if [[ -n "$(tail -c1 "$body" 2>/dev/null || true)" ]]; then
                  echo
                fi
              fi
            } >"$out"

            if cmp -s "$f" "$out"; then
              echo "unchanged $f"
              rm -f "$out"
            else
              mv "$out" "$f"
              echo "updated $f"
            fi
            rm -f "$body" "$counts_file"
          }

          # Note: avoid bash ''${#...} in this Nix string — `#` starts a Nix comment.
          files=()
          if [[ $# -eq 0 ]]; then
            while IFS= read -r p || [[ -n "''${p:-}" ]]; do
              [[ -n "''${p:-}" ]] && files+=("$p")
            done < <(
              find Clash Surge Loon Shadowrocket \
                -type f \( -path '*/Rules/*' \) \( -name '*.list' -o -name '*.yaml' \) \
                2>/dev/null | LC_ALL=C sort
            )
          else
            files=("$@")
          fi

          file_count=0
          for _ in "''${files[@]+"''${files[@]}"}"; do
            file_count=$((file_count + 1))
          done

          if [[ "$file_count" -eq 0 ]]; then
            echo "no rule files found" >&2
            exit 1
          fi

          changed=0
          for f in "''${files[@]}"; do
            [[ -n "$f" ]] || continue
            before="$(cksum <"$f" 2>/dev/null || true)"
            process_file "$f"
            after="$(cksum <"$f" 2>/dev/null || true)"
            if [[ "$before" != "$after" ]]; then
              changed=$((changed + 1))
            fi
          done
          echo "done: $changed/$file_count files changed (root=$root)"
        '';
      };

    # Toolchain used by `nix fmt` / `nix run .#fmt`
    mkFmt = pkgs: let
      prettier = pkgs.prettier or pkgs.nodePackages.prettier;

      yamlfmt-clash = pkgs.writeShellApplication {
        name = "proxyrules-yamlfmt";
        runtimeInputs = [
          pkgs.yamlfmt
          pkgs.perl
          pkgs.coreutils
        ];
        text = ''
          set -euo pipefail
          conf_args=()
          if [ -f yamlfmt.yml ]; then
            conf_args=(-conf yamlfmt.yml)
          fi
          for f in "$@"; do
            [ -f "$f" ] || continue
            case "$f" in
              *.yaml|*.yml) ;;
              *) continue ;;
            esac
            tmp="$(mktemp)"
            yamlfmt "''${conf_args[@]}" - <"$f" >"$tmp"
            perl -pi -e 's/!!merge <<:/<<:/g' "$tmp"
            if ! cmp -s "$f" "$tmp"; then
              mv "$tmp" "$f"
            else
              rm -f "$tmp"
            fi
          done
        '';
      };

      trim-ws = pkgs.writeShellApplication {
        name = "proxyrules-trim-ws";
        runtimeInputs = [
          pkgs.perl
          pkgs.coreutils
        ];
        text = ''
          set -euo pipefail
          for f in "$@"; do
            [ -f "$f" ] || continue
            tmp="$(mktemp)"
            perl -pe 's/^[ \t]+//; s/[ \t]+$//' "$f" | perl -pe 'chomp if eof' >"$tmp"
            if [ -s "$tmp" ] || [ -s "$f" ]; then
              printf '\n' >>"$tmp"
            fi
            if ! cmp -s "$f" "$tmp"; then
              mv "$tmp" "$f"
            else
              rm -f "$tmp"
            fi
          done
        '';
      };

      tools = [
        pkgs.treefmt
        pkgs.yamlfmt
        yamlfmt-clash
        prettier
        pkgs.nixfmt
        trim-ws
      ];
    in
      pkgs.writeShellApplication {
        name = "proxyrules-fmt";
        runtimeInputs = tools;
        text = ''
          exec treefmt "$@"
        '';
      };
  in {
    packages = forAllSystems (
      system: let
        pkgs = pkgsFor system;
        fmt = mkFmt pkgs;
        update-rule-headers = mkUpdateRuleHeaders pkgs;
      in {
        inherit fmt update-rule-headers;
        default = fmt;
      }
    );

    formatter = forAllSystems (system: self.packages.${system}.fmt);

    devShells = forAllSystems (
      system: let
        pkgs = pkgsFor system;
      in {
        default = pkgs.mkShell {
          packages = [
            (mkFmt pkgs)
            (mkUpdateRuleHeaders pkgs)
          ];
        };
      }
    );
  };
}
