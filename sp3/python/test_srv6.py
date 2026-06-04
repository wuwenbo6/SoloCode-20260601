#!/usr/bin/env python3
"""Test suite for SRv6 Simulator."""

import json
import subprocess
import sys
import os
from srv6_simulator import (
    generate_random_prefix,
    generate_sid,
    generate_sid_list,
    find_longest_common_prefix,
    find_common_prefix_between,
    find_branch_points_in_path,
    group_sids_by_prefix,
    compress_sids_by_prefix,
    compress_sids_full,
    generate_usid_block,
    generate_usid,
    generate_usid_list,
    pack_usids_into_carrier,
    compress_usids,
    generate_compression_report,
    build_srh,
    simulate,
)


def run_command(cmd, input_data=None):
    """Run a command and return the result."""
    process = subprocess.run(
        cmd,
        input=input_data,
        capture_output=True,
        text=True,
        shell=True
    )
    return process.returncode, process.stdout, process.stderr


def test_generate_random_prefix():
    """Test random prefix generation."""
    print("Testing generate_random_prefix...")
    prefix = generate_random_prefix()
    print(f"  Generated prefix: {prefix}")
    assert prefix.endswith('::'), "Prefix should end with ::"
    parts = prefix.rstrip(':').split(':')
    assert len(parts) == 3, f"Expected 3 hextets, got {len(parts)}"
    print("  ✓ Pass")


def test_generate_sid():
    """Test SID generation."""
    print("\nTesting generate_sid...")
    prefix = "2001:db8:1234::"
    sid = generate_sid(prefix, 1, locator=42)
    print(f"  Generated SID: {sid}")
    assert sid.startswith("2001:db8:1234:"), "SID should start with prefix"
    print("  ✓ Pass")


def test_generate_sid_list():
    """Test SID list generation."""
    print("\nTesting generate_sid_list...")
    sids = generate_sid_list(5, "2001:db8:1234::", shared_prefix_ratio=0.8)
    print(f"  Generated {len(sids)} SIDs")
    assert len(sids) == 5, f"Expected 5 SIDs, got {len(sids)}"
    for i, sid in enumerate(sids):
        print(f"    [{i}] {sid['address']} ({sid['function']})")
        assert 'address' in sid, "SID should have address"
        assert 'function' in sid, "SID should have function"
        assert 'description' in sid, "SID should have description"
    print("  ✓ Pass")


def test_find_longest_common_prefix():
    """Test finding longest common prefix."""
    print("\nTesting find_longest_common_prefix...")
    addresses = [
        "2001:db8:1234:0001:0000:0000:0000:0001",
        "2001:db8:1234:0001:0000:0000:0000:0002",
        "2001:db8:1234:0001:0000:0000:0000:0003",
    ]
    prefix = find_longest_common_prefix(addresses)
    print(f"  Addresses: {addresses}")
    print(f"  Common prefix: {prefix}")
    assert "2001:db8:1234:0001:0000:0000:0000" in prefix, "Should find common prefix"
    print("  ✓ Pass")


def test_compress_sids_by_prefix():
    """Test prefix-based compression with branch preservation."""
    print("\nTesting compress_sids_by_prefix...")
    sids = [
        {"address": "2001:db8:1234:0001:0000:0000:0000:0001", 
         "function": "End", "description": "Endpoint"},
        {"address": "2001:db8:1234:0001:0000:0000:0000:0002",
         "function": "End.X", "description": "Endpoint X"},
        {"address": "2001:db8:1234:0001:0000:0000:0000:0003",
         "function": "End.DX4", "description": "Endpoint DX4"},
    ]
    compressed, shared_prefix, info = compress_sids_by_prefix(sids)
    print(f"  Shared prefix: {shared_prefix}")
    print(f"  Compression info: {info}")
    print(f"  Compressed SIDs:")
    for sid in compressed:
        print(f"    {sid['address']} (compressed: {sid['compressed']})")
    assert len(compressed) == 3, "Should keep all SIDs"
    assert shared_prefix, "Should find shared prefix"
    assert info['num_groups'] == 1, "Should be 1 group"
    assert info['sids_at_branch'] == 1, "First SID preserved at branch"
    assert info['sids_compressed'] == 2, "2 SIDs should be compressed"
    assert compressed[0]['compressed'] == False, "First SID not compressed (branch node)"
    assert compressed[1]['compressed'] == True, "Second SID compressed"
    assert compressed[2]['compressed'] == True, "Third SID compressed"
    
    compressed_no_preserve, _, info_no_preserve = compress_sids_by_prefix(
        sids, compression_depth=8, preserve_branches=False
    )
    print(f"\n  Without branch preservation:")
    print(f"    SIDs compressed: {info_no_preserve['sids_compressed']}")
    for sid in compressed_no_preserve:
        print(f"    {sid['address']} (compressed: {sid['compressed']})")
    assert all(sid['compressed'] for sid in compressed_no_preserve), "All should be compressed when preserve_branches=False"
    
    print("  ✓ Pass")


def test_compress_sids_full():
    """Test full compression (duplicate removal)."""
    print("\nTesting compress_sids_full...")
    sids = [
        {"address": "2001:db8::1", "function": "End", "description": "Endpoint"},
        {"address": "2001:db8::1", "function": "End", "description": "Endpoint"},
        {"address": "2001:db8::2", "function": "End.X", "description": "Endpoint X"},
    ]
    compressed, shared_prefix, info = compress_sids_full(sids)
    print(f"  Original: {len(sids)} SIDs")
    print(f"  After compression: {len(compressed)} SIDs")
    print(f"  Duplicates removed: {info['duplicates_removed']}")
    assert len(compressed) == 2, "Should have 2 unique SIDs"
    assert info['duplicates_removed'] == 1, "Should remove 1 duplicate"
    print("  ✓ Pass")


def test_build_srh():
    """Test SRH building."""
    print("\nTesting build_srh...")
    sids = [
        {"address": "2001:db8::1", "function": "End", "description": "Endpoint"},
        {"address": "2001:db8::2", "function": "End.X", "description": "Endpoint X"},
    ]
    fields, total_length = build_srh(sids)
    print(f"  SRH Fields:")
    for field in fields:
        print(f"    {field['name']}: {field['value']} ({field['length']} bytes)")
    print(f"  Total SRH length: {total_length} bytes")
    assert total_length == 8 + (2 * 16), "SRH should be 8 + 32 = 40 bytes"
    assert len(fields) == 7 + 2, "Should have 7 header fields + 2 segments"
    print("  ✓ Pass")


def test_simulate_function():
    """Test the full simulate function."""
    print("\nTesting simulate function...")
    result = simulate(
        sid_count=5,
        compression_method='prefix'
    )
    print(f"  Original SIDs: {len(result['originalSids'])}")
    print(f"  Compressed SIDs: {len(result['compressedSids'])}")
    print(f"  Original length: {result['originalTotalLength']} bytes")
    print(f"  Compressed length: {result['compressedTotalLength']} bytes")
    print(f"  Compression ratio: {result['compressionRatio']:.2f}%")
    print(f"  Bytes saved: {result['bytesSaved']} bytes")
    print(f"  SRH total length: {result['srhTotalLength']} bytes")
    assert 'originalSids' in result
    assert 'compressedSids' in result
    assert 'srhFields' in result
    assert len(result['originalSids']) == 5
    print("  ✓ Pass")


def test_cli_interface():
    """Test CLI interface."""
    print("\nTesting CLI interface...")
    script_path = os.path.join(os.path.dirname(__file__), 'srv6_simulator.py')
    
    rc, stdout, stderr = run_command(
        f"python3 {script_path} --count 3 --method prefix"
    )
    print(f"  Return code: {rc}")
    if stderr:
        print(f"  Stderr: {stderr}")
    
    assert rc == 0, f"CLI should return 0, got {rc}"
    
    output = json.loads(stdout)
    assert output['success'] == True
    assert len(output['data']['originalSids']) == 3
    print("  ✓ Pass")


def test_cli_with_json_input():
    """Test CLI with JSON input via stdin."""
    print("\nTesting CLI with JSON input...")
    script_path = os.path.join(os.path.dirname(__file__), 'srv6_simulator.py')
    
    input_json = json.dumps({
        "sidCount": 4,
        "compressionMethod": "prefix"
    })
    
    rc, stdout, stderr = run_command(
        f"python3 {script_path}",
        input_data=input_json
    )
    print(f"  Return code: {rc}")
    assert rc == 0, f"CLI should return 0, got {rc}"
    
    output = json.loads(stdout)
    assert output['success'] == True
    assert len(output['data']['originalSids']) == 4
    print("  ✓ Pass")


def test_custom_sids():
    """Test with custom SIDs."""
    print("\nTesting custom SIDs...")
    custom_sids = [
        "2001:db8:aaaa::1",
        "2001:db8:aaaa::2",
        "2001:db8:aaaa::3",
    ]
    result = simulate(custom_sids=custom_sids)
    print(f"  Custom SIDs provided: {len(custom_sids)}")
    print(f"  Generated SIDs: {len(result['originalSids'])}")
    assert len(result['originalSids']) == 3
    for i, sid in enumerate(result['originalSids']):
        assert sid['address'] == custom_sids[i]
    print("  ✓ Pass")


def test_find_common_prefix_between():
    """Test finding common prefix between two addresses."""
    print("\nTesting find_common_prefix_between...")
    
    a = "2001:db8:1234:0001:0000:0000:0000:0001"
    b = "2001:db8:1234:0001:0000:0000:0000:0002"
    prefix = find_common_prefix_between(a, b, max_depth=8)
    print(f"  A: {a}")
    print(f"  B: {b}")
    print(f"  Common prefix: {prefix}")
    
    prefix_hextets = prefix.rstrip(':').split(':')
    assert len(prefix_hextets) == 7, "Should find 7 common hextets"
    assert "2001:db8:1234:0001:0000:0000:0000" in prefix
    
    c = "2001:db8:1234:0002:0000:0000:0000:0001"
    prefix2 = find_common_prefix_between(a, c, max_depth=8)
    print(f"  A: {a}")
    print(f"  C: {c}")
    print(f"  Common prefix: {prefix2}")
    
    prefix2_hextets = prefix2.rstrip(':').split(':')
    assert len(prefix2_hextets) == 3, "Should only find 3 common hextets"
    
    d = "fc00:abcd::1"
    prefix3 = find_common_prefix_between(a, d, max_depth=8)
    print(f"  A: {a}")
    print(f"  D: {d}")
    print(f"  Common prefix: '{prefix3}'")
    assert prefix3 == "", "Should have no common prefix"
    print("  ✓ Pass")


def test_find_branch_points_in_path():
    """Test branch point detection in SID path."""
    print("\nTesting find_branch_points_in_path...")
    
    addresses_with_branch = [
        "2001:db8:1234:0001:0000:0000:0000:0001",
        "2001:db8:1234:0001:0000:0000:0000:0002",
        "2001:db8:1234:0001:0000:0000:0000:0003",
        "fc00:abcd:1234:0001:0000:0000:0000:0001",
        "fc00:abcd:1234:0001:0000:0000:0000:0002",
    ]
    branch_points = find_branch_points_in_path(addresses_with_branch)
    print(f"  Path: {addresses_with_branch}")
    print(f"  Branch points at indices: {branch_points}")
    assert 3 in branch_points, "Should detect branch at index 3 (prefix change)"
    
    addresses_straight = [
        "2001:db8:1234:0001:0000:0000:0000:0001",
        "2001:db8:1234:0001:0000:0000:0000:0002",
        "2001:db8:1234:0001:0000:0000:0000:0003",
    ]
    branch_points_straight = find_branch_points_in_path(addresses_straight)
    print(f"  Straight path: {addresses_straight}")
    print(f"  Branch points: {branch_points_straight}")
    assert len(branch_points_straight) == 0, "No branches in straight path"
    print("  ✓ Pass")


def test_group_sids_by_prefix():
    """Test grouping SIDs by common prefix."""
    print("\nTesting group_sids_by_prefix...")
    
    sids = [
        {"address": "2001:db8:1234:0001:0000:0000:0000:0001", 
         "function": "End", "description": "Endpoint 1"},
        {"address": "2001:db8:1234:0001:0000:0000:0000:0002",
         "function": "End.X", "description": "Endpoint 2"},
        {"address": "2001:db8:1234:0001:0000:0000:0000:0003",
         "function": "End.DX4", "description": "Endpoint 3"},
        {"address": "fc00:abcd:1234:0001:0000:0000:0000:0001",
         "function": "End", "description": "Endpoint 4"},
        {"address": "fc00:abcd:1234:0001:0000:0000:0000:0002",
         "function": "End.X", "description": "Endpoint 5"},
    ]
    
    groups = group_sids_by_prefix(sids, max_depth=8)
    print(f"  Number of groups: {len(groups)}")
    assert len(groups) == 2, "Should create 2 groups (different prefixes)"
    assert len(groups[0]) == 3, "First group has 3 SIDs"
    assert len(groups[1]) == 2, "Second group has 2 SIDs"
    
    print(f"  Group 0 prefix: {groups[0][0]['address'].split(':')[0:3]}")
    print(f"  Group 1 prefix: {groups[1][0]['address'].split(':')[0:3]}")
    
    assert groups[0][0]["address"].startswith("2001:db8:1234")
    assert groups[1][0]["address"].startswith("fc00:abcd:1234")
    print("  ✓ Pass")


def test_compression_depth_limit():
    """Test compression with depth limit."""
    print("\nTesting compression depth limit...")
    
    sids = [
        {"address": "2001:db8:1234:0001:aaaa:bbbb:cccc:0001", 
         "function": "End", "description": "Endpoint"},
        {"address": "2001:db8:1234:0001:aaaa:bbbb:cccc:0002",
         "function": "End.X", "description": "Endpoint X"},
    ]
    
    compressed_deep, prefix_deep, info_deep = compress_sids_by_prefix(
        sids, compression_depth=6, preserve_branches=True
    )
    print(f"  Depth 6 compression:")
    print(f"    Prefix: {prefix_deep}")
    print(f"    Prefix hextets: {info_deep['prefix_hextets']}")
    print(f"    Compressed SID 0: {compressed_deep[0]['address']}")
    assert info_deep['prefix_hextets'] == 6, "Should compress 6 hextets"
    
    compressed_shallow, prefix_shallow, info_shallow = compress_sids_by_prefix(
        sids, compression_depth=3, preserve_branches=True
    )
    print(f"  Depth 3 compression:")
    print(f"    Prefix: {prefix_shallow}")
    print(f"    Prefix hextets: {info_shallow['prefix_hextets']}")
    print(f"    Compressed SID 0: {compressed_shallow[0]['address']}")
    assert info_shallow['prefix_hextets'] == 3, "Should only compress 3 hextets"
    
    assert info_deep['compressed_bytes'] < info_shallow['compressed_bytes'], \
        "Deeper compression should result in smaller size"
    print("  ✓ Pass")


def test_branch_preservation():
    """Test that branches are preserved during compression."""
    print("\nTesting branch preservation...")
    
    sids_with_branch = [
        {"address": "2001:db8:1234:0001:0000:0000:0000:0001", 
         "function": "End", "description": "Endpoint"},
        {"address": "2001:db8:1234:0001:0000:0000:0000:0002",
         "function": "End.X", "description": "Endpoint X"},
        {"address": "2001:db8:1234:0001:0000:0000:0000:0003",
         "function": "End.DX4", "description": "Endpoint DX4"},
        {"address": "fc00:abcd:1234:0001:0000:0000:0000:0001",
         "function": "End", "description": "Branch point"},
        {"address": "fc00:abcd:1234:0001:0000:0000:0000:0002",
         "function": "End.X", "description": "After branch"},
    ]
    
    compressed_preserve, prefix_preserve, info_preserve = compress_sids_by_prefix(
        sids_with_branch, compression_depth=8, preserve_branches=True
    )
    print(f"  With branch preservation:")
    print(f"    Overall prefix: {prefix_preserve}")
    print(f"    Number of groups: {info_preserve['num_groups']}")
    print(f"    Branch points at indices: {info_preserve['branch_points']}")
    print(f"    SIDs compressed: {info_preserve['sids_compressed']}")
    print(f"    SIDs at branch (preserved): {info_preserve['sids_at_branch']}")
    print(f"    Compressed SIDs:")
    for i, sid in enumerate(compressed_preserve):
        print(f"      [{i}] {sid['address']} (compressed={sid['compressed']}, group={sid.get('group_index')})")
    
    assert info_preserve['preserve_branches'] == True
    assert info_preserve['num_groups'] == 2, "Should have 2 groups"
    assert info_preserve['sids_at_branch'] == 2, "First SID of each group is preserved"
    assert info_preserve['sids_compressed'] == 3, "3 SIDs should be compressed"
    
    assert compressed_preserve[0]['compressed'] == False, "First SID of group 0 not compressed"
    assert compressed_preserve[1]['compressed'] == True, "Second SID of group 0 compressed"
    assert compressed_preserve[2]['compressed'] == True, "Third SID of group 0 compressed"
    assert compressed_preserve[3]['compressed'] == False, "First SID of group 1 not compressed (branch)"
    assert compressed_preserve[4]['compressed'] == True, "Second SID of group 1 compressed"
    
    sids_straight = [
        {"address": "2001:db8:1234:0001:0000:0000:0000:0001", 
         "function": "End", "description": "Endpoint"},
        {"address": "2001:db8:1234:0001:0000:0000:0000:0002",
         "function": "End.X", "description": "Endpoint X"},
        {"address": "2001:db8:1234:0001:0000:0000:0000:0003",
         "function": "End.DX4", "description": "Endpoint DX4"},
    ]
    
    compressed_straight, _, info_straight = compress_sids_by_prefix(
        sids_straight, compression_depth=8, preserve_branches=True
    )
    print(f"\n  Straight path (no branches):")
    print(f"    Number of groups: {info_straight['num_groups']}")
    print(f"    SIDs at branch: {info_straight['sids_at_branch']}")
    print(f"    SIDs compressed: {info_straight['sids_compressed']}")
    assert info_straight['num_groups'] == 1, "Only 1 group for straight path"
    assert info_straight['sids_at_branch'] == 1, "Only first SID preserved"
    assert info_straight['sids_compressed'] == 2, "2 SIDs compressed"
    
    print("  ✓ Pass")


def test_simulate_with_new_params():
    """Test simulate function with new compression parameters."""
    print("\nTesting simulate with new parameters...")
    result = simulate(
        sid_count=5,
        compression_method='prefix',
        compression_depth=4,
        preserve_branches=True
    )
    print(f"  Compression method: {result['compressionMethod']}")
    print(f"  Compression info: {result['compressionInfo']}")
    assert 'depth=4' in result['compressionMethod']
    assert 'preserve_branches=True' in result['compressionMethod']
    assert result['compressionInfo']['max_compression_depth'] == 4
    assert result['compressionInfo']['preserve_branches'] == True
    print("  ✓ Pass")


def test_cli_with_depth_param():
    """Test CLI with new depth and preserve-branches parameters."""
    print("\nTesting CLI with depth parameter...")
    script_path = os.path.join(os.path.dirname(__file__), 'srv6_simulator.py')
    
    input_json = json.dumps({
        "sidCount": 4,
        "compressionMethod": "prefix",
        "compressionDepth": 5,
        "preserveBranches": True
    })
    
    rc, stdout, stderr = run_command(
        f"python3 {script_path}",
        input_data=input_json
    )
    print(f"  Return code: {rc}")
    assert rc == 0, f"CLI should return 0, got {rc}"
    
    output = json.loads(stdout)
    assert output['success'] == True
    data = output['data']
    assert data['compressionInfo']['max_compression_depth'] == 5
    assert data['compressionInfo']['preserve_branches'] == True
    print("  ✓ Pass")


def test_generate_usid():
    """Test uSID generation."""
    print("\nTesting generate_usid...")
    usid = generate_usid("fc00:0000::", usid_value=0x00010001)
    print(f"  uSID: {usid}")
    assert usid['address'] == "fc00:0000:0001:0001::", f"Expected fc00:0000:0001:0001::, got {usid['address']}"
    assert usid['format'] == 'usid'
    assert usid['usid_value'] == 0x00010001
    assert usid['block'] == 'fc00:0000::'
    print("  ✓ Pass")


def test_pack_usids_into_carrier():
    """Test packing uSIDs into a carrier."""
    print("\nTesting pack_usids_into_carrier...")
    usids = [
        generate_usid("fc00:0000::", usid_value=0x00010001),
        generate_usid("fc00:0000::", usid_value=0x00020002),
        generate_usid("fc00:0000::", usid_value=0x00030003),
    ]
    carrier_addr, carrier_info = pack_usids_into_carrier(usids, "fc00:0000::")
    print(f"  Carrier address: {carrier_addr}")
    print(f"  Carrier info: {carrier_info}")
    assert carrier_info['num_usids'] == 3
    assert carrier_info['savings'] == 3 * 16 - 16, "3 uSIDs packed in 1 carrier saves 32 bytes"
    assert len(carrier_addr.split(':')) == 8, "Carrier should be full 8-hextet address"
    print("  ✓ Pass")


def test_compress_usids():
    """Test uSID compression."""
    print("\nTesting compress_usids...")
    usids = generate_usid_list(8, block="fc00:0000::", shared_block_ratio=1.0)
    carriers, comp_info = compress_usids(usids)
    print(f"  8 uSIDs → {comp_info['total_carriers']} carriers")
    print(f"  Original: {comp_info['original_bytes']} bytes")
    print(f"  Compressed: {comp_info['compressed_bytes']} bytes")
    print(f"  Savings: {comp_info['bytes_saved']} bytes ({comp_info['compression_ratio']}%)")
    assert comp_info['total_usids'] == 8
    assert comp_info['total_carriers'] == 2, f"8 uSIDs in same block should fit in 2 carriers, got {comp_info['total_carriers']}"
    assert comp_info['bytes_saved'] > 0
    assert comp_info['compression_ratio'] > 0
    print("  ✓ Pass")


def test_simulate_usid_format():
    """Test simulate with uSID format."""
    print("\nTesting simulate with uSID format...")
    result = simulate(sid_count=6, sid_format='usid')
    print(f"  SID Format: {result.get('sidFormat')}")
    print(f"  uSID Info present: {'usidInfo' in result}")
    if result.get('usidInfo'):
        print(f"  Total uSIDs: {result['usidInfo']['total_usids']}")
        print(f"  Total Carriers: {result['usidInfo']['total_carriers']}")
        print(f"  uSID Savings: {result['usidInfo']['bytes_saved']} bytes")
    assert result.get('sidFormat') == 'usid'
    assert 'usidInfo' in result
    assert result['usidInfo']['total_usids'] == 6
    assert result['usidInfo']['total_carriers'] >= 1
    print("  ✓ Pass")


def test_compression_report():
    """Test compression report generation."""
    print("\nTesting generate_compression_report...")
    result = simulate(sid_count=3)
    report = generate_compression_report(result)
    print(f"  Report length: {len(report)} chars")
    assert "SRv6 SID Compression Report" in report
    assert "Original SID List" in report
    assert "Compression Results" in report
    assert "SRH Structure" in report
    print("  ✓ Pass")


def test_simulate_report_in_result():
    """Test that simulate includes report in result."""
    print("\nTesting report in simulate result...")
    result = simulate(sid_count=3)
    assert 'report' in result
    assert len(result['report']) > 0
    assert "SRv6 SID Compression Report" in result['report']
    print("  ✓ Pass")


def test_cli_usid_format():
    """Test CLI with uSID format."""
    print("\nTesting CLI with uSID format...")
    script_path = os.path.join(os.path.dirname(__file__), 'srv6_simulator.py')
    
    input_json = json.dumps({
        "sidCount": 5,
        "sidFormat": "usid",
    })
    
    rc, stdout, stderr = run_command(
        f"python3 {script_path}",
        input_data=input_json
    )
    assert rc == 0, f"CLI should return 0, got {rc}"
    
    output = json.loads(stdout)
    assert output['success'] == True
    data = output['data']
    assert data.get('sidFormat') == 'usid'
    assert 'usidInfo' in data
    print("  ✓ Pass")


def main():
    """Run all tests."""
    print("=" * 60)
    print("SRv6 Simulator Test Suite")
    print("=" * 60)
    
    tests = [
        test_generate_random_prefix,
        test_generate_sid,
        test_generate_sid_list,
        test_find_longest_common_prefix,
        test_find_common_prefix_between,
        test_find_branch_points_in_path,
        test_group_sids_by_prefix,
        test_compress_sids_by_prefix,
        test_compression_depth_limit,
        test_branch_preservation,
        test_compress_sids_full,
        test_generate_usid,
        test_pack_usids_into_carrier,
        test_compress_usids,
        test_simulate_usid_format,
        test_compression_report,
        test_simulate_report_in_result,
        test_build_srh,
        test_simulate_function,
        test_simulate_with_new_params,
        test_cli_interface,
        test_cli_with_json_input,
        test_cli_with_depth_param,
        test_cli_usid_format,
        test_custom_sids,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"  ✗ Failed: {e}")
            failed += 1
        except Exception as e:
            print(f"  ✗ Error: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
