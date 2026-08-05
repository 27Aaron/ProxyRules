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

    mkFmt = pkgs: let
      prettier = pkgs.prettier or pkgs.nodePackages.prettier;

      # yamlfmt rewrites <<: as !!merge; Clash/Mihomo needs the short form.
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

      # .list / .conf: strip leading+trailing whitespace (no indent on rules)
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
      in {
        inherit fmt;
        default = fmt;
      }
    );

    formatter = forAllSystems (system: self.packages.${system}.fmt);

    devShells = forAllSystems (
      system: let
        pkgs = pkgsFor system;
      in {
        default = pkgs.mkShell {
          packages = [self.packages.${system}.fmt];
        };
      }
    );
  };
}
