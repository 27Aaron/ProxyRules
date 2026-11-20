# Custom Rules

Hand-maintained rules. Edit `Sources/<service>/<service>.list`, then regenerate. Never edit `Rules/`.

```bash
python3 scripts/convert.py
python3 scripts/mrs.py
```

A run with no rule change writes nothing. Unknown rule types and options fail the converter instead of being skipped.

```
Sources/<service>/<service>.list      source
Rules/<service>/<service>.list        list
Rules/<service>/<service>.yaml        clash
Rules/<service>/<service>.mrs         mihomo domain
Rules/<service>/<service>.ipcidr.mrs  mihomo ipcidr
Rules/<service>/<service>.egern.yaml  egern
```

## Adding a service

1. Add `Sources/<service>/<service>.list`
2. Add a `DISPLAY_NAMES` entry in `scripts/convert.py` if the directory name does not read well as a title
3. Run `python3 scripts/convert.py`
4. Commit `Sources/` and `Rules/`
