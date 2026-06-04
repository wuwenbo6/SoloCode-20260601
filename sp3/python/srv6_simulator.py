#!/usr/bin/env python3
"""SRv6 Simulator - SID generation, compression, and SRH encapsulation."""

import json
import random
import sys
import argparse
import ipaddress
from typing import List, Dict, Tuple, Optional


SID_FUNCTIONS = [
    {"function": "End", "description": "Endpoint - Plain SRv6 endpoint"},
    {"function": "End.X", "description": "Endpoint with decapsulation"},
    {"function": "End.DX4", "description": "Endpoint with IPv4 decapsulation"},
    {"function": "End.DX6", "description": "Endpoint with IPv6 decapsulation"},
    {"function": "End.DT4", "description": "Endpoint with IPv4 table lookup"},
    {"function": "End.DT6", "description": "Endpoint with IPv6 table lookup"},
    {"function": "End.B6", "description": "Endpoint with binding"},
    {"function": "End.BM", "description": "Endpoint with max binding"},
    {"function": "End.US", "description": "Endpoint with unspecified"},
    {"function": "End.UD", "description": "Endpoint with dynamic"},
]


def generate_random_prefix() -> str:
    """Generate a random SRv6 prefix (48 bits)."""
    parts = [
        format(random.randint(0, 0xFFFF), '04x'),
        format(random.randint(0, 0xFFFF), '04x'),
        format(random.randint(0, 0xFFFF), '04x'),
    ]
    return ':'.join(parts) + '::'


def generate_sid(prefix: str, function_id: int, locator: Optional[int] = None) -> str:
    """Generate a single SRv6 SID address.
    
    Format: PREFIX:LOCATOR:FUNC:ARGS1:ARGS2:ARGS3 (128 bits total, 8 hextets)
    """
    if locator is None:
        locator = random.randint(0, 0xFFFF)
    
    func = format(function_id & 0xFFFF, '04x')
    args1 = format(random.randint(0, 0xFFFF), '04x')
    args2 = format(random.randint(0, 0xFFFF), '04x')
    args3 = format(random.randint(0, 0xFFFF), '04x')
    locator_hex = format(locator, '04x')
    
    base = prefix.rstrip(':').rstrip(':')
    base_parts = [p for p in base.split(':') if p]
    
    if len(base_parts) >= 4:
        base = ':'.join(base_parts[:3])
    elif len(base_parts) == 3:
        base = ':'.join(base_parts)
    
    return f"{base}:{locator_hex}:{func}:{args1}:{args2}:{args3}"


def generate_sid_list(count: int, prefix: Optional[str] = None, 
                       shared_prefix_ratio: float = 0.7) -> List[Dict]:
    """Generate a list of SRv6 SIDs with function descriptions.
    
    Args:
        count: Number of SIDs to generate
        prefix: Optional shared prefix (random if not provided)
        shared_prefix_ratio: Ratio of SIDs that share the same prefix
    """
    if prefix is None:
        prefix = generate_random_prefix()
    
    sids = []
    shared_count = int(count * shared_prefix_ratio)
    
    for i in range(count):
        if i < shared_count:
            current_prefix = prefix
        else:
            current_prefix = generate_random_prefix()
        
        func_info = random.choice(SID_FUNCTIONS)
        function_id = SID_FUNCTIONS.index(func_info)
        
        address = generate_sid(current_prefix, function_id, locator=i + 1)
        
        sids.append({
            "address": address,
            "function": func_info["function"],
            "description": func_info["description"]
        })
    
    return sids


def find_longest_common_prefix(addresses: List[str]) -> str:
    """Find the longest common prefix among a list of IPv6 addresses.
    
    Works at the hextet (16-bit) level.
    """
    if not addresses:
        return ""
    
    hextets_list = [addr.split(':') for addr in addresses]
    
    min_length = min(len(hextets) for hextets in hextets_list)
    
    common_hextets = []
    for i in range(min_length):
        current_hextet = hextets_list[0][i]
        if all(hextets[i] == current_hextet for hextets in hextets_list):
            common_hextets.append(current_hextet)
        else:
            break
    
    if not common_hextets:
        return ""
    
    prefix = ':'.join(common_hextets)
    if len(common_hextets) < 8:
        prefix += ':'
    
    return prefix


def find_common_prefix_between(a: str, b: str, max_depth: int = 8) -> str:
    """Find the longest common prefix between two addresses up to max_depth."""
    hextets_a = a.split(':')
    hextets_b = b.split(':')
    
    common = []
    check_depth = min(max_depth, len(hextets_a), len(hextets_b), 8)
    
    for i in range(check_depth):
        if hextets_a[i] == hextets_b[i]:
            common.append(hextets_a[i])
        else:
            break
    
    if not common:
        return ""
    
    prefix = ':'.join(common)
    if len(common) < 8:
        prefix += ':'
    
    return prefix


def find_branch_points_in_path(addresses: List[str], max_depth: int = 8) -> List[int]:
    """Identify branch points in the SID path.
    
    A branch point occurs when consecutive SIDs have different prefixes,
    indicating a path change or topology branch.
    
    Args:
        addresses: List of IPv6 addresses in path order
        max_depth: Maximum depth to check (1-8 hextets)
    
    Returns:
        List of indices (0-indexed) where branches occur
    """
    if len(addresses) < 2:
        return []
    
    branch_indices = []
    
    for i in range(1, len(addresses)):
        prev = addresses[i - 1]
        curr = addresses[i]
        
        common_prefix = find_common_prefix_between(prev, curr, max_depth)
        
        if not common_prefix:
            branch_indices.append(i)
        else:
            prefix_hextets = len(common_prefix.rstrip(':').split(':'))
            if prefix_hextets < 3:
                branch_indices.append(i)
    
    return branch_indices


def group_sids_by_prefix(sids: List[Dict], max_depth: int = 8) -> List[List[Dict]]:
    """Group consecutive SIDs that share a common prefix.
    
    Groups represent straight, unbranched path segments.
    SIDs in different groups have significantly different prefixes,
    indicating a branch or path change.
    
    Args:
        sids: List of SID dictionaries
        max_depth: Maximum depth for prefix comparison (1-8)
    
    Returns:
        List of SID groups, each group is a list of consecutive SIDs
    """
    if not sids:
        return []
    
    groups = []
    current_group = [sids[0]]
    
    for i in range(1, len(sids)):
        prev_addr = current_group[-1]["address"]
        curr_addr = sids[i]["address"]
        
        common_prefix = find_common_prefix_between(prev_addr, curr_addr, max_depth)
        prefix_hextets = len(common_prefix.rstrip(':').split(':')) if common_prefix else 0
        
        if prefix_hextets >= 3:
            current_group.append(sids[i])
        else:
            groups.append(current_group)
            current_group = [sids[i]]
    
    if current_group:
        groups.append(current_group)
    
    return groups


def compress_sids_by_prefix(sids: List[Dict], compression_depth: int = 8, 
                           preserve_branches: bool = True) -> Tuple[List[Dict], str, Dict]:
    """Compress SID list by identifying and removing redundant shared prefixes.
    
    Enhanced algorithm with group-based branch awareness:
    1. Groups consecutive SIDs that share a common prefix (straight path segments)
    2. Only compresses within each group - no compression across groups (branch points)
    3. At branch points (group boundaries), full SIDs are preserved
    4. Supports compression depth limiting
    
    Algorithm:
    - Split SID list into groups where each group shares a common prefix
    - For each group, find the group's longest common prefix (up to compression_depth)
    - Compress SIDs within the group using the group's prefix
    - The first SID of each group is preserved in full (branch node)
    - Subsequent SIDs in the group can be compressed
    
    Args:
        sids: List of SID dictionaries
        compression_depth: Maximum number of hextets to compress (1-8, default 8)
        preserve_branches: If True, preserve full SIDs at branch points (group boundaries)
    
    Returns:
        Tuple of (compressed_sids, shared_prefix, compression_info)
    """
    if not sids:
        return [], "", {}
    
    compression_depth = max(1, min(compression_depth, 8))
    
    if not preserve_branches:
        addresses = [sid["address"] for sid in sids]
        shared_prefix = find_longest_common_prefix(addresses)
        prefix_hextets = len(shared_prefix.rstrip(':').split(':')) if shared_prefix else 0
        
        compressed_sids = []
        sids_compressed = 0
        
        for sid in sids:
            address = sid["address"]
            is_compressed = False
            
            if shared_prefix and address.startswith(shared_prefix.rstrip(':')):
                suffix = address[len(shared_prefix.rstrip(':')):]
                if suffix.startswith(':'):
                    suffix = suffix[1:]
                compressed_address = f"...:{suffix}"
                is_compressed = True
                sids_compressed += 1
            else:
                compressed_address = address
            
            compressed_sids.append({
                "address": compressed_address,
                "full_address": address,
                "function": sid["function"],
                "description": sid["description"],
                "compressed": is_compressed
            })
        
        bytes_saved_per_sid = prefix_hextets * 2 if prefix_hextets > 0 else 0
        original_bytes = len(sids) * 16
        compressed_bytes = original_bytes - (sids_compressed * bytes_saved_per_sid)
        compressed_bytes = max(8, compressed_bytes)
        
        compression_info = {
            "total_sids": len(sids),
            "sids_compressed": sids_compressed,
            "sids_at_branch": len(sids) - sids_compressed,
            "prefix_hextets": prefix_hextets,
            "max_compression_depth": compression_depth,
            "branch_points": [],
            "num_groups": 1,
            "preserve_branches": False,
            "original_bytes": original_bytes,
            "compressed_bytes": compressed_bytes,
        }
        
        return compressed_sids, shared_prefix, compression_info
    
    groups = group_sids_by_prefix(sids, compression_depth)
    
    compressed_sids = []
    group_details = []
    sids_compressed = 0
    sids_at_branch = 0
    
    overall_prefix = ""
    
    for group_idx, group in enumerate(groups):
        group_addresses = [sid["address"] for sid in group]
        group_prefix = find_longest_common_prefix(group_addresses)
        
        if group_prefix:
            prefix_hextets_count = len(group_prefix.rstrip(':').split(':'))
            limited_hextets = min(prefix_hextets_count, compression_depth)
            prefix_parts = group_prefix.rstrip(':').split(':')[:limited_hextets]
            group_prefix = ':'.join(prefix_parts)
            if limited_hextets < 8:
                group_prefix += ':'
        else:
            limited_hextets = 0
        
        if group_idx == 0:
            overall_prefix = group_prefix
        
        group_compressed = 0
        
        for sid_idx, sid in enumerate(group):
            address = sid["address"]
            is_compressed = False
            
            if preserve_branches and sid_idx == 0:
                compressed_address = address
                sids_at_branch += 1
            elif group_prefix and address.startswith(group_prefix.rstrip(':')):
                suffix = address[len(group_prefix.rstrip(':')):]
                if suffix.startswith(':'):
                    suffix = suffix[1:]
                compressed_address = f"...:{suffix}"
                is_compressed = True
                sids_compressed += 1
                group_compressed += 1
            else:
                compressed_address = address
                sids_at_branch += 1
            
            compressed_sids.append({
                "address": compressed_address,
                "full_address": address,
                "function": sid["function"],
                "description": sid["description"],
                "compressed": is_compressed,
                "group_index": group_idx,
            })
        
        group_details.append({
            "group_index": group_idx,
            "group_size": len(group),
            "prefix": group_prefix,
            "prefix_hextets": limited_hextets,
            "sids_compressed": group_compressed,
        })
    
    branch_indices = find_branch_points_in_path([sid["address"] for sid in sids], compression_depth)
    
    original_bytes = len(sids) * 16
    compressed_bytes = original_bytes
    
    for detail in group_details:
        if detail["prefix_hextets"] > 0 and detail["sids_compressed"] > 0:
            bytes_saved = detail["sids_compressed"] * detail["prefix_hextets"] * 2
            compressed_bytes -= bytes_saved
    
    compressed_bytes = max(8, compressed_bytes)
    
    prefix_hextets = 0
    for detail in group_details:
        if detail["prefix_hextets"] > prefix_hextets:
            prefix_hextets = detail["prefix_hextets"]
    
    compression_info = {
        "total_sids": len(sids),
        "sids_compressed": sids_compressed,
        "sids_at_branch": sids_at_branch,
        "prefix_hextets": prefix_hextets,
        "max_compression_depth": compression_depth,
        "branch_points": branch_indices,
        "num_groups": len(groups),
        "group_details": group_details,
        "preserve_branches": True,
        "original_bytes": original_bytes,
        "compressed_bytes": compressed_bytes,
    }
    
    return compressed_sids, overall_prefix, compression_info


def compress_sids_full(sids: List[Dict]) -> Tuple[List[Dict], str, Dict]:
    """Full compression - remove duplicate SIDs entirely."""
    if not sids:
        return [], "", {}
    
    seen = set()
    compressed_sids = []
    shared_prefix = find_longest_common_prefix([sid["address"] for sid in sids])
    
    for sid in sids:
        addr = sid["address"]
        if addr not in seen:
            seen.add(addr)
            compressed_sids.append({
                "address": addr,
                "full_address": addr,
                "function": sid["function"],
                "description": sid["description"],
                "compressed": False
            })
    
    compression_info = {
        "total_sids": len(sids),
        "unique_sids": len(compressed_sids),
        "duplicates_removed": len(sids) - len(compressed_sids),
        "original_bytes": len(sids) * 16,
        "compressed_bytes": len(compressed_sids) * 16,
    }
    
    return compressed_sids, shared_prefix, compression_info


USID_BLOCK_PREFIXES = {
    "fc00:0000": {"name": "Local uSID Block", "prefix_len": 32},
    "2001:db8": {"name": "Documentation uSID Block", "prefix_len": 32},
    "0000:0000": {"name": "Default uSID Block", "prefix_len": 32},
}

USID_FUNCTIONS = [
    {"uSID": 0x0000, "function": "uN", "description": "uSID Node"},
    {"uSID": 0x0001, "function": "uA", "description": "uSID Adjacency"},
    {"uSID": 0x0002, "function": "uDX4", "description": "uSID Decap IPv4"},
    {"uSID": 0x0003, "function": "uDX6", "description": "uSID Decap IPv6"},
    {"uSID": 0x0004, "function": "uDT4", "description": "uSID Table IPv4"},
    {"uSID": 0x0005, "function": "uDT6", "description": "uSID Table IPv6"},
    {"uSID": 0x0006, "function": "uB6", "description": "uSID Binding"},
    {"uSID": 0x0007, "function": "uBM", "description": "uSID Max Binding"},
]


def generate_usid_block() -> str:
    """Generate a random uSID block prefix (32 bits).
    
    uSID block format: PREFIX::/32 (first 2 hextets)
    """
    part1 = format(random.randint(0, 0xFFFF), '04x')
    part2 = format(random.randint(0, 0xFFFF), '04x')
    return f"{part1}:{part2}::"


def generate_usid(block: str, usid_value: Optional[int] = None) -> Dict:
    """Generate a single uSID (32-bit micro-segment).
    
    uSID format (RFC 9403):
    - Block (32 bits): First 2 hextets identifying the uSID block
    - uSID (32 bits): Micro-segment identifier
    - Argument (64 bits): Optional argument field
    
    A single uSID fits in 32 bits, allowing up to 4 uSIDs per 128-bit address.
    
    Args:
        block: uSID block prefix (e.g., "fc00:0000")
        usid_value: Optional uSID value (0-0xFFFFFFFF)
    
    Returns:
        Dictionary with uSID information
    """
    if usid_value is None:
        usid_value = random.randint(0x0100, 0xFFFF)
    
    block_parts = block.rstrip(':').split(':')
    if len(block_parts) < 2:
        block = f"{block}:0000"
        block_parts = block.rstrip(':').split(':')
    
    block_h1 = block_parts[0]
    block_h2 = block_parts[1]
    
    usid_hex = format(usid_value & 0xFFFFFFFF, '08x')
    usid_h3 = usid_hex[0:4]
    usid_h4 = usid_hex[4:8]
    
    full_address = f"{block_h1}:{block_h2}:{usid_h3}:{usid_h4}::"
    
    func_info = None
    for f in USID_FUNCTIONS:
        if (usid_value & 0xFF00) >> 8 == (f["uSID"] & 0xFF):
            func_info = f
            break
    if func_info is None:
        func_info = {"uSID": usid_value, "function": "uN", "description": f"uSID Node ({usid_value:#x})"}
    
    return {
        "address": full_address,
        "usid_value": usid_value,
        "usid_hex": usid_hex,
        "block": f"{block_h1}:{block_h2}::",
        "function": func_info["function"],
        "description": func_info["description"],
        "format": "usid",
    }


def pack_usids_into_carrier(usids: List[Dict], block: str) -> Tuple[str, Dict]:
    """Pack multiple uSIDs into a single 128-bit uSID Carrier.
    
    RFC 9403: Up to 4 uSIDs (each 32 bits) can be packed into one
    128-bit IPv6 address called a uSID Carrier.
    
    Carrier format:
    - Block Prefix (32 bits): uSID block identifier
    - uSID[0] (32 bits): First micro-segment
    - uSID[1] (32 bits): Second micro-segment
    - uSID[2] (32 bits): Third micro-segment
    - uSID[3] (32 bits): Fourth micro-segment (last entry / terminator)
    
    Args:
        usids: List of uSID dictionaries (up to 4)
        block: uSID block prefix
    
    Returns:
        Tuple of (carrier_address, carrier_info)
    """
    num_usids = min(len(usids), 4)
    
    block_parts = block.rstrip(':').split(':')
    block_h1 = block_parts[0] if len(block_parts) > 0 else "fc00"
    block_h2 = block_parts[1] if len(block_parts) > 1 else "0000"
    
    hextets = [block_h1, block_h2]
    
    for i in range(4):
        if i < num_usids:
            val = usids[i].get("usid_value", 0)
            usid_hex = format(val & 0xFFFFFFFF, '08x')
            hextets.append(usid_hex[0:4])
            hextets.append(usid_hex[4:8])
        else:
            terminator = 0x00000000 if i == num_usids else 0xFFFFFFFF
            term_hex = format(terminator, '08x')
            hextets.append(term_hex[0:4])
            hextets.append(term_hex[4:8])
    
    carrier_address = ':'.join(hextets[:8])
    
    packed_functions = []
    for i in range(num_usids):
        packed_functions.append({
            "index": i,
            "usid_value": usids[i].get("usid_value", 0),
            "function": usids[i].get("function", "uN"),
            "description": usids[i].get("description", ""),
        })
    
    carrier_info = {
        "carrier_address": carrier_address,
        "block": f"{block_h1}:{block_h2}::",
        "num_usids": num_usids,
        "packed_functions": packed_functions,
        "bytes_used": 16,
        "bytes_equivalent": num_usids * 16,
        "savings": (num_usids * 16) - 16,
    }
    
    return carrier_address, carrier_info


def generate_usid_list(count: int, block: Optional[str] = None,
                        shared_block_ratio: float = 0.8) -> List[Dict]:
    """Generate a list of uSIDs.
    
    Args:
        count: Number of uSIDs to generate
        block: Optional shared uSID block prefix
        shared_block_ratio: Ratio of uSIDs sharing the same block
    
    Returns:
        List of uSID dictionaries
    """
    if block is None:
        block = generate_usid_block()
    
    usids = []
    shared_count = int(count * shared_block_ratio)
    
    for i in range(count):
        if i < shared_count:
            current_block = block
        else:
            current_block = generate_usid_block()
        
        usid = generate_usid(current_block, usid_value=random.randint(0x0100 + i, 0xFFFF))
        usids.append(usid)
    
    return usids


def compress_usids(usids: List[Dict]) -> Tuple[List[Dict], Dict]:
    """Compress uSID list by packing into carriers.
    
    Groups uSIDs by block prefix, then packs up to 4 uSIDs
    per carrier address.
    
    Args:
        usids: List of uSID dictionaries
    
    Returns:
        Tuple of (carrier_list, compression_info)
    """
    if not usids:
        return [], {"total_usids": 0, "total_carriers": 0, "original_bytes": 0, "compressed_bytes": 0}
    
    block_groups: Dict[str, List[Dict]] = {}
    for usid in usids:
        block = usid.get("block", "fc00:0000::")
        if block not in block_groups:
            block_groups[block] = []
        block_groups[block].append(usid)
    
    carriers = []
    total_original_bytes = len(usids) * 16
    total_compressed_bytes = 0
    carrier_details = []
    
    for block, block_usids in block_groups.items():
        for i in range(0, len(block_usids), 4):
            chunk = block_usids[i:i+4]
            carrier_addr, carrier_info = pack_usids_into_carrier(chunk, block)
            carriers.append({
                "address": carrier_addr,
                "function": f"uSID Carrier ({carrier_info['num_usids']} uSIDs)",
                "description": f"Packed: {', '.join(f['function'] for f in carrier_info['packed_functions'])}",
                "compressed": True,
                "format": "usid_carrier",
                "carrier_info": carrier_info,
            })
            total_compressed_bytes += 16
            carrier_details.append(carrier_info)
    
    total_savings = total_original_bytes - total_compressed_bytes
    compression_ratio = (total_savings / total_original_bytes * 100) if total_original_bytes > 0 else 0
    
    compression_info = {
        "format": "usid",
        "total_usids": len(usids),
        "total_carriers": len(carriers),
        "num_blocks": len(block_groups),
        "block_groups": {k: len(v) for k, v in block_groups.items()},
        "original_bytes": total_original_bytes,
        "compressed_bytes": total_compressed_bytes,
        "bytes_saved": total_savings,
        "compression_ratio": round(compression_ratio, 2),
        "carrier_details": carrier_details,
    }
    
    return carriers, compression_info


def generate_compression_report(result: Dict) -> str:
    """Generate a human-readable compression report.
    
    Args:
        result: The simulate() result dictionary
    
    Returns:
        Formatted text report string
    """
    lines = []
    lines.append("=" * 70)
    lines.append("SRv6 SID Compression Report")
    lines.append("=" * 70)
    lines.append("")
    
    lines.append("--- Simulation Parameters ---")
    lines.append(f"  Compression Method: {result.get('compressionMethod', 'N/A')}")
    comp_info = result.get('compressionInfo', {})
    lines.append(f"  Compression Depth: {comp_info.get('max_compression_depth', 'N/A')} hextets")
    lines.append(f"  Preserve Branches: {comp_info.get('preserve_branches', 'N/A')}")
    lines.append("")
    
    lines.append("--- Original SID List ---")
    for i, sid in enumerate(result.get('originalSids', [])):
        lines.append(f"  [{i}] {sid['address']} ({sid['function']})")
    lines.append("")
    
    lines.append("--- Compression Results ---")
    lines.append(f"  Original Total Length:  {result.get('originalTotalLength', 0)} bytes")
    lines.append(f"  Compressed Total Length: {result.get('compressedTotalLength', 0)} bytes")
    lines.append(f"  Bytes Saved:            {result.get('bytesSaved', 0)} bytes")
    lines.append(f"  Compression Ratio:      {result.get('compressionRatio', 0):.2f}%")
    lines.append(f"  Shared Prefix:          {result.get('sharedPrefix', 'N/A')}")
    lines.append("")
    
    if comp_info.get('num_groups'):
        lines.append("--- Group Details ---")
        lines.append(f"  Number of Groups: {comp_info['num_groups']}")
        lines.append(f"  Branch Points: {comp_info.get('branch_points', [])}")
        lines.append(f"  SIDs Compressed: {comp_info.get('sids_compressed', 0)}")
        lines.append(f"  SIDs at Branch: {comp_info.get('sids_at_branch', 0)}")
        for gd in comp_info.get('group_details', []):
            lines.append(f"  Group {gd['group_index']}: "
                        f"{gd['group_size']} SIDs, "
                        f"prefix_hextets={gd['prefix_hextets']}, "
                        f"compressed={gd['sids_compressed']}")
        lines.append("")
    
    lines.append("--- Compressed SID List ---")
    for i, sid in enumerate(result.get('compressedSids', [])):
        comp_mark = " [COMPRESSED]" if sid.get('compressed') else " [BRANCH]"
        group_mark = f" (G{sid.get('group_index', '')})" if sid.get('group_index') is not None else ""
        lines.append(f"  [{i}] {sid['address']}{comp_mark}{group_mark}")
    lines.append("")
    
    lines.append("--- SRH Structure ---")
    lines.append(f"  Original SRH Length: {result.get('srhTotalLength', 0)} bytes")
    lines.append(f"  Compressed SRH Length: {result.get('compressedSrhTotalLength', 0)} bytes")
    lines.append("")
    
    usid_info = result.get('usidInfo')
    if usid_info:
        lines.append("--- uSID Micro-Segment Details ---")
        lines.append(f"  Format: uSID (RFC 9403)")
        lines.append(f"  Total uSIDs: {usid_info.get('total_usids', 0)}")
        lines.append(f"  Total Carriers: {usid_info.get('total_carriers', 0)}")
        lines.append(f"  Number of Blocks: {usid_info.get('num_blocks', 0)}")
        lines.append(f"  uSID Compressed: {usid_info.get('compressed_bytes', 0)} bytes")
        lines.append(f"  uSID Savings: {usid_info.get('bytes_saved', 0)} bytes")
        lines.append(f"  uSID Compression Ratio: {usid_info.get('compression_ratio', 0):.2f}%")
        for cd in usid_info.get('carrier_details', []):
            funcs = ', '.join(f['function'] for f in cd['packed_functions'])
            lines.append(f"  Carrier {cd['carrier_address']}: "
                        f"{cd['num_usids']} uSIDs [{funcs}] "
                        f"(saves {cd['savings']} bytes)")
        lines.append("")
    
    lines.append("=" * 70)
    lines.append("End of Report")
    lines.append("=" * 70)
    
    return '\n'.join(lines)


def build_srh(sids: List[Dict], compressed: bool = False) -> Tuple[List[Dict], int]:
    """Build the Segment Routing Header (SRH) structure.
    
    SRH Format (RFC 8754):
    - Next Header: 8 bits
    - Hdr Ext Len: 8 bits (length in 8-octet units, not including first 8 octets)
    - Routing Type: 8 bits (4 for SRH)
    - Segments Left: 8 bits
    - Last Entry: 8 bits
    - Flags: 8 bits
    - Tag: 16 bits
    - Segment List: 128 * N bits (N SIDs)
    """
    num_sids = len(sids)
    
    srh_base_size = 8
    segment_list_size = num_sids * 16
    total_length = srh_base_size + segment_list_size
    
    hdr_ext_len = (total_length // 8) - 1
    
    srh_fields = [
        {
            "name": "Next Header",
            "value": "0x3C (IPv6)",
            "length": 1,
            "description": "Next header type (IPv6 = 60 = 0x3C)"
        },
        {
            "name": "Hdr Ext Len",
            "value": f"{hdr_ext_len}",
            "length": 1,
            "description": "Header extension length in 8-octet units"
        },
        {
            "name": "Routing Type",
            "value": "4 (SRH)",
            "length": 1,
            "description": "Routing type - SRH is type 4"
        },
        {
            "name": "Segments Left",
            "value": f"{num_sids}",
            "length": 1,
            "description": "Number of segments remaining to be processed"
        },
        {
            "name": "Last Entry",
            "value": f"{num_sids - 1}",
            "length": 1,
            "description": "Index of the last element in the segment list"
        },
        {
            "name": "Flags",
            "value": "0x00",
            "length": 1,
            "description": "Flags (unused in basic SRH)"
        },
        {
            "name": "Tag",
            "value": "0x0000",
            "length": 2,
            "description": "Tag for policy matching"
        },
    ]
    
    for i, sid in enumerate(reversed(sids)):
        srh_fields.append({
            "name": f"Segment [{num_sids - 1 - i}]",
            "value": sid["address"],
            "length": 16,
            "description": f"SRv6 SID - {sid['function']}: {sid['description']}"
        })
    
    return srh_fields, total_length


def simulate(sid_count: int = 5, custom_sids: Optional[List[str]] = None,
             prefix: Optional[str] = None, compression_method: str = 'prefix',
             compression_depth: int = 8, preserve_branches: bool = True,
             sid_format: str = 'srv6') -> Dict:
    """Run the full SRv6 simulation.
    
    Args:
        sid_count: Number of SIDs to generate
        custom_sids: Optional list of custom SID addresses
        prefix: Optional shared prefix
        compression_method: 'prefix' or 'full'
        compression_depth: Maximum hextets to compress (1-8)
        preserve_branches: If True, stop compression at branch points
        sid_format: 'srv6' for standard 128-bit SIDs, 'usid' for micro-segments
    """
    
    usid_info = None
    usid_carriers = None
    
    if sid_format == 'usid':
        if custom_sids and len(custom_sids) > 0:
            usids = []
            for addr in custom_sids:
                parts = addr.rstrip(':').split(':')
                block = ':'.join(parts[:2]) + '::' if len(parts) >= 2 else 'fc00:0000::'
                usid_val = int(parts[2] + parts[3], 16) if len(parts) >= 4 else random.randint(0x0100, 0xFFFF)
                usid = generate_usid(block, usid_value=usid_val)
                usids.append(usid)
        else:
            block = prefix if prefix else None
            usids = generate_usid_list(sid_count, block)
        
        sids = usids[:]
        sid_count = len(sids)
        
        usid_carriers, usid_comp_info = compress_usids(usids)
        usid_info = usid_comp_info
        
        compressed_sids, shared_prefix, comp_info = compress_sids_by_prefix(
            sids, compression_depth=compression_depth, preserve_branches=preserve_branches
        )
        
        if compression_method == 'prefix':
            method_desc = f"Prefix+uSID Compression (depth={compression_depth})"
        else:
            compressed_sids, shared_prefix, comp_info = compress_sids_full(sids)
            method_desc = "Full+uSID Compression"
    elif custom_sids and len(custom_sids) > 0:
        sids = []
        for addr in custom_sids:
            func_info = random.choice(SID_FUNCTIONS)
            sids.append({
                "address": addr.strip(),
                "function": func_info["function"],
                "description": func_info["description"]
            })
        sid_count = len(sids)
        
        if compression_method == 'prefix':
            compressed_sids, shared_prefix, comp_info = compress_sids_by_prefix(
                sids, compression_depth=compression_depth, preserve_branches=preserve_branches
            )
            method_desc = f"Prefix Compression (depth={compression_depth}, preserve_branches={preserve_branches})"
        else:
            compressed_sids, shared_prefix, comp_info = compress_sids_full(sids)
            method_desc = "Full Compression (duplicate removal)"
    else:
        sids = generate_sid_list(sid_count, prefix)
        
        if compression_method == 'prefix':
            compressed_sids, shared_prefix, comp_info = compress_sids_by_prefix(
                sids, compression_depth=compression_depth, preserve_branches=preserve_branches
            )
            method_desc = f"Prefix Compression (depth={compression_depth}, preserve_branches={preserve_branches})"
        else:
            compressed_sids, shared_prefix, comp_info = compress_sids_full(sids)
            method_desc = "Full Compression (duplicate removal)"
    
    original_total_length = len(sids) * 16
    compressed_total_length = comp_info.get("compressed_bytes", original_total_length)
    
    if original_total_length > 0:
        compression_ratio = (1 - compressed_total_length / original_total_length) * 100
    else:
        compression_ratio = 0
    
    bytes_saved = original_total_length - compressed_total_length
    
    srh_fields, srh_total_length = build_srh(sids)
    compressed_srh_fields, compressed_srh_length = build_srh(compressed_sids, compressed=True)
    
    result = {
        "originalSids": sids,
        "compressedSids": compressed_sids,
        "originalTotalLength": original_total_length,
        "compressedTotalLength": compressed_total_length,
        "compressionRatio": round(compression_ratio, 2),
        "bytesSaved": bytes_saved,
        "srhFields": srh_fields,
        "compressedSrhFields": compressed_srh_fields,
        "srhTotalLength": srh_total_length,
        "compressedSrhTotalLength": compressed_srh_length,
        "sharedPrefix": shared_prefix,
        "compressionMethod": method_desc,
        "compressionInfo": comp_info,
        "sidFormat": sid_format,
    }
    
    if usid_info:
        result["usidInfo"] = usid_info
        result["usidCarriers"] = usid_carriers
    
    result["report"] = generate_compression_report(result)
    
    return result


def main():
    """Main entry point - accepts JSON via stdin or command line args."""
    parser = argparse.ArgumentParser(description='SRv6 Simulator')
    parser.add_argument('--mode', default='simulate', help='Operation mode')
    parser.add_argument('--count', type=int, default=5, help='Number of SIDs')
    parser.add_argument('--method', default='prefix', 
                       choices=['prefix', 'full'], help='Compression method')
    parser.add_argument('--prefix', help='Shared prefix')
    parser.add_argument('--depth', type=int, default=8, 
                       help='Compression depth (1-8 hextets)')
    parser.add_argument('--no-preserve-branches', action='store_true',
                       help='Disable branch preservation (compress all common prefixes)')
    parser.add_argument('--format', default='srv6',
                       choices=['srv6', 'usid'], help='SID format (srv6 or usid)')
    parser.add_argument('--report', action='store_true',
                       help='Output text report instead of JSON')
    
    args = parser.parse_args()
    
    if not sys.stdin.isatty():
        try:
            input_data = json.load(sys.stdin)
            sid_count = input_data.get('sidCount', args.count)
            custom_sids = input_data.get('customSids')
            prefix = input_data.get('prefix', args.prefix)
            compression_method = input_data.get('compressionMethod', args.method)
            compression_depth = input_data.get('compressionDepth', args.depth)
            preserve_branches = input_data.get('preserveBranches', not args.no_preserve_branches)
            sid_format = input_data.get('sidFormat', args.format)
        except json.JSONDecodeError:
            sid_count = args.count
            custom_sids = None
            prefix = args.prefix
            compression_method = args.method
            compression_depth = args.depth
            preserve_branches = not args.no_preserve_branches
            sid_format = args.format
    else:
        sid_count = args.count
        custom_sids = None
        prefix = args.prefix
        compression_method = args.method
        compression_depth = args.depth
        preserve_branches = not args.no_preserve_branches
        sid_format = args.format
    
    result = simulate(
        sid_count=sid_count,
        custom_sids=custom_sids,
        prefix=prefix,
        compression_method=compression_method,
        compression_depth=compression_depth,
        preserve_branches=preserve_branches,
        sid_format=sid_format
    )
    
    if args.report:
        print(result.get("report", ""))
    else:
        output = {
            "success": True,
            "data": result
        }
        print(json.dumps(output, indent=2))


if __name__ == '__main__':
    main()
