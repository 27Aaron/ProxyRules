"""Mihomo rule-set (MRS) encoder.

MRS is the binary rule-provider format read by mihomo (Clash Meta) when a
rule-provider sets ``format: mrs``. It is not a Clash config by itself.

Two behaviors exist, and a file holds only one of them:

- domain (byte 0): DOMAIN and DOMAIN-SUFFIX
- ipcidr (byte 1): IP-CIDR and IP-CIDR6

DOMAIN-KEYWORD and DOMAIN-REGEX have no MRS representation. Callers keep
those rules in the classical YAML provider.

The on-disk file is a zstd frame. After decompression the payload is MRSv1,
matching MetaCubeX/mihomo (rules/provider/mrs_converter.go):

    "MRS"  version=1  behavior  count:int64be  extra_len:int64be  body

The domain body is the succinct trie from component/trie/domain_set.go.
The ipcidr body is the merged address ranges from component/cidr.
"""

import ipaddress
import struct


_DOMAIN_BEHAVIOR = 0
_IPCIDR_BEHAVIOR = 1


class _Node:
    def __init__(self):
        self.children = {}
        self.has_data = False


def compile_mrs(entries):
    """Build MRS payloads for one source list.

    Returns ``({suffix: bytes}, skipped)`` where suffix is ``"mrs"`` or
    ``"ipcidr.mrs"``. ``skipped`` is a list of rule types MRS cannot store.
    An empty behavior is omitted rather than written as an empty file.
    """
    domain_rules = []
    ip_rules = []
    skipped = []
    for rtype, value, _no_resolve in entries:
        if rtype == "DOMAIN":
            domain_rules.append(value)
        elif rtype == "DOMAIN-SUFFIX":
            domain_rules.append("+." + value)
        elif rtype in ("IP-CIDR", "IP-CIDR6"):
            ip_rules.append(value)
        else:
            skipped.append(rtype)

    files = {}
    if domain_rules:
        files["mrs"] = _encode(_DOMAIN_BEHAVIOR, len(domain_rules), _domain_body(domain_rules))
    if ip_rules:
        files["ipcidr.mrs"] = _encode(_IPCIDR_BEHAVIOR, len(ip_rules), _ipcidr_body(ip_rules))
    return files, skipped


def _encode(behavior, count, body):
    raw = b"MRS" + bytes((1, behavior))
    raw += struct.pack(">q", count)
    raw += struct.pack(">q", 0)  # extra section, reserved and empty
    raw += body
    return _zstd_frame(raw)


def _domain_body(rules):
    keys = _domain_keys(rules)
    rev = sorted(key[::-1] for key in keys)
    labels = []
    label_bits = []
    leaf_bits = []
    label_idx = 0

    # Transcribed from DomainTrie.NewDomainSet. `rev` is sorted so equal
    # prefixes stay contiguous and shorter keys come first.
    queue = [(0, len(rev), 0)]
    node = 0
    while node < len(queue):
        start, end, col = queue[node]
        if col == len(rev[start]):
            _set_bit(leaf_bits, node, 1)
            start += 1
        pos = start
        while pos < end:
            group = pos
            if col >= len(rev[group]):
                raise SystemExit("duplicate domain while building MRS trie")
            char = rev[group][col]
            while pos < end and col < len(rev[pos]) and rev[pos][col] == char:
                pos += 1
            queue.append((group, pos, col + 1))
            labels.append(char)
            _set_bit(label_bits, label_idx, 0)
            label_idx += 1
        _set_bit(label_bits, label_idx, 1)
        label_idx += 1
        node += 1

    try:
        label_bytes = "".join(labels).encode("ascii")
    except UnicodeEncodeError:
        raise SystemExit("MRS domain contains a non-ASCII label")
    return _set_payload(leaf_bits, label_bits, label_bytes)


def _domain_keys(rules):
    """Keys mihomo's domain trie would emit for these text rules.

    ``+.example.com`` inserts both the suffix and the apex, so the trie
    contains ``example.com`` and ``+.example.com`` while the header count
    stays at one insert per rule.
    """
    root = _Node()
    for rule in rules:
        if "/" in rule:
            raise SystemExit(f"invalid MRS domain: {rule}")
        parts = _split_domain(rule)
        if parts is None:
            raise SystemExit(f"invalid MRS domain: {rule}")
        if parts[0] == "+":
            _insert(root, parts[1:])
            _insert(root, ["", *parts[1:]])
        else:
            _insert(root, parts)
    return _collect(root)


def _split_domain(domain):
    if not domain or domain[-1] == ".":
        return None
    if domain[0].isspace() or domain[-1].isspace():
        return None
    parts = domain.lower().split(".")
    if len(parts) == 1:
        return parts if parts[0] else None
    if any(part == "" for part in parts[1:]):
        return None
    return parts


def _insert(root, parts):
    node = root
    for part in reversed(parts):
        node = node.children.setdefault(part, _Node())
    node.has_data = True


def _collect(root):
    found = []

    def walk(node, items):
        if node.has_data and items:
            domain = ".".join(items)
            if domain.startswith("."):
                domain = "+" + domain
            found.append(domain)
        for label, child in node.children.items():
            walk(child, [label, *items])

    walk(root, [])
    return found


def _set_payload(leaf_bits, label_bits, label_bytes):
    out = bytes((1,))  # domain-set version
    out += _u64s(_pack_bits(leaf_bits))
    out += _u64s(_pack_bits(label_bits))
    out += struct.pack(">q", len(label_bytes))
    out += label_bytes
    return out


def _ipcidr_body(cidrs):
    ranges = []
    for cidr in cidrs:
        try:
            network = ipaddress.ip_network(cidr, strict=True)
        except ValueError as exc:
            raise SystemExit(f"invalid MRS IP-CIDR: {cidr}") from exc
        start = int(network.network_address)
        end = int(network.broadcast_address)
        ranges.append((network.version, start, end))
    ranges.sort()
    merged = []
    for version, start, end in ranges:
        if merged and merged[-1][0] == version and start <= merged[-1][2] + 1:
            merged[-1] = (version, merged[-1][1], max(merged[-1][2], end))
        else:
            merged.append((version, start, end))

    out = bytes((1,))  # ip-set version
    out += struct.pack(">q", len(merged))
    for version, start, end in merged:
        out += _addr16(version, start)
        out += _addr16(version, end)
    return out


def _addr16(version, number):
    # netip.Addr.As16 maps IPv4 to ::ffff:a.b.c.d. IPv6 is already 16 bytes.
    if version == 4:
        return b"\x00" * 10 + b"\xff\xff" + number.to_bytes(4, "big")
    return number.to_bytes(16, "big")


def _set_bit(bits, index, value):
    if index >= len(bits):
        bits.extend([0] * (index + 1 - len(bits)))
    if value:
        bits[index] = 1


def _pack_bits(bits):
    if not bits:
        raise SystemExit("internal error: empty MRS bitmap")
    words = []
    for word in range((len(bits) + 63) // 64):
        value = 0
        for bit in range(64):
            index = word * 64 + bit
            if index < len(bits) and bits[index]:
                value |= 1 << bit
        words.append(value)
    return words


def _u64s(words):
    out = struct.pack(">q", len(words))
    out += b"".join(struct.pack(">Q", word) for word in words)
    return out


def _zstd_frame(data):
    """Wrap ``data`` in a zstd frame of raw (uncompressed) blocks.

    mihomo only requires a frame it can decompress; it does not care that
    the blocks are stored rather than compressed. Raw blocks keep the output
    deterministic with no zstd library.
    """
    if len(data) >= (1 << 21):
        raise SystemExit("MRS payload exceeds a zstd block")
    window = _window_descriptor(len(data))
    header = b"\x28\xb5\x2f\xfd"
    header += bytes((0x80,))  # content size is a u32; no checksum, no dict
    header += bytes((window,))
    header += struct.pack("<I", len(data))
    header += _raw_block_header(len(data), last=True)
    return header + data


def _window_descriptor(size):
    # Smallest mantissa-0 window (min 1 KiB) that can hold one raw block.
    need = max(size, 1024)
    exponent = 0
    while (1 << (10 + exponent)) < need:
        exponent += 1
    if exponent > 31:
        raise SystemExit("MRS payload exceeds zstd window")
    return exponent << 3


def _raw_block_header(size, last):
    # 3-byte little-endian header: last (1) | type raw (2) | size (21).
    value = (1 if last else 0) | (size << 3)
    return value.to_bytes(3, "little")


def main():
    from convert import OUT_DIR, REPO_ROOT, SRC_DIR, mrs_note, parse_entries, store

    updated = 0
    for list_path in sorted(SRC_DIR.glob("*/*.list")):
        source = list_path.relative_to(REPO_ROOT).as_posix()
        entries = parse_entries(list_path.read_text(encoding="utf-8").splitlines(), source)
        mrs_files, mrs_skipped = compile_mrs(entries)
        out_dir = OUT_DIR / list_path.parent.name
        out_dir.mkdir(parents=True, exist_ok=True)
        for suffix, content in mrs_files.items():
            path = out_dir / f"{list_path.stem}.{suffix}"
            if not store(path, content):
                continue
            print(f"updated {path.relative_to(REPO_ROOT)}")
            updated += 1
        print(f"{source}: {len(entries)} rules{mrs_note(mrs_files, mrs_skipped)}")
    print(f"done, {updated} file(s) updated")


if __name__ == "__main__":
    main()
