#!/usr/bin/env python3
"""
Create unified society registry (owc_info.json) that combines:
- HRAF societies (from existing owc_info.json)
- SCCS societies (from SCCS.glbl)
- EA societies (from EA.owc and societies.csv)

Output: resources/owc_info.json (unified format)
"""

import csv
import json
import os
import re
from collections import OrderedDict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RES_DIR = os.path.join(SCRIPT_DIR, 'resources')
DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'dplace-data', 'datasets', 'EA')


def load_hraf_societies():
    """Load HRAF societies from existing owc_info.json."""
    path = os.path.join(RES_DIR, 'owc_info.json')
    if not os.path.exists(path):
        print(f"  Warning: {path} not found, no HRAF societies loaded")
        return {}

    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Index by OWC ID (lowercase)
    societies = {}
    for entry in data.get('data', []):
        owc_id = entry.get('id', '').lower()
        if owc_id:
            societies[owc_id] = {
                'hraf_name': entry.get('term', ''),
                'hraf_summary': entry.get('description', ''),
                'region': entry.get('highest_bt', ''),
                'societies': []
            }

    print(f"  Loaded {len(societies)} HRAF societies")
    return societies


def load_sccs_societies():
    """Load SCCS societies from SCCS.glbl."""
    # Parse the AWK heredoc format
    path = os.path.join(RES_DIR, 'SCCS.glbl')
    if not os.path.exists(path):
        print(f"  Warning: {path} not found, no SCCS societies loaded")
        return {}

    societies = OrderedDict()
    in_data = False

    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')

            # Skip AWK wrapper
            if 'exec nawk' in line or 'BEGIN' in line or 'END' in line or line.strip() == "'":
                continue
            if '<<EOF' in line:
                in_data = True
                continue
            if line.strip() == 'EOF':
                break

            if in_data and line.strip():
                parts = line.split('\t')
                if len(parts) >= 3:
                    case_id = parts[0].strip()
                    name = parts[1].strip()
                    year = parts[2].strip() if len(parts) > 2 else ''
                    lat = parts[3].strip() if len(parts) > 3 else ''
                    lon = parts[4].strip() if len(parts) > 4 else ''

                    societies[case_id] = {
                        'name': name,
                        'year': year,
                        'latitude': lat,
                        'longitude': lon
                    }

    print(f"  Loaded {len(societies)} SCCS societies")
    return societies


def load_ea_societies():
    """Load EA societies from societies.csv."""
    path = os.path.join(DATA_DIR, 'societies.csv')
    if not os.path.exists(path):
        print(f"  Warning: {path} not found, no EA societies loaded")
        return {}

    societies = OrderedDict()

    with open(path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            soc_id = row['id']  # e.g., 'Aa1', 'Na3'

            # Parse HRAF link to extract OWC ID
            hraf_link = row.get('HRAF_link', '')
            owc_match = re.search(r'owc=([A-Z]{2}\d+)', hraf_link, re.IGNORECASE)
            owc = owc_match.group(1).lower() if owc_match else ''

            societies[soc_id] = {
                'xd_id': row.get('xd_id', ''),
                'pref_name': row.get('pref_name_for_society', ''),
                'orig_name_id': row.get('ORIG_name_and_ID_in_this_dataset', ''),
                'alt_names': row.get('alt_names_by_society', ''),
                'focal_year': row.get('main_focal_year', ''),
                'latitude': row.get('Lat', ''),
                'longitude': row.get('Long', ''),
                'glottocode': row.get('glottocode', ''),
                'glottocode_comment': row.get('glottocode_comment', ''),
                'comment': row.get('Comment', ''),
                'owc': owc,
                'hraf_name_id': row.get('HRAF_name_ID', '')
            }

    print(f"  Loaded {len(societies)} EA societies")
    return societies


def link_sccs_to_hraf(sccs_societies, hraf_societies):
    """
    Link SCCS societies to HRAF societies based on:
    1. Matching sccs_group from owc_info.json
    2. Name similarity
    """
    # Load the original owc_info.json to get sccs_group mappings
    path = os.path.join(RES_DIR, 'owc_info.json')
    if not os.path.exists(path):
        return {}

    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Build mapping: sccs_group -> HRAF OWC ID
    sccs_to_hraf = {}
    for entry in data.get('data', []):
        sccs_group = entry.get('sccs_group', '')
        owc_id = entry.get('id', '').lower()
        if sccs_group and owc_id:
            sccs_to_hraf[sccs_group] = owc_id

    return sccs_to_hraf


def build_unified_registry():
    """Build the unified society registry."""
    print("Building unified society registry...")
    print("=" * 50)

    # Load all societies
    print("\n1. Loading HRAF societies...")
    hraf_societies = load_hraf_societies()

    print("\n2. Loading SCCS societies...")
    sccs_societies = load_sccs_societies()

    print("\n3. Loading EA societies...")
    ea_societies = load_ea_societies()

    print("\n4. Linking SCCS to HRAF...")
    sccs_to_hraf = link_sccs_to_hraf(sccs_societies, hraf_societies)

    # Build unified registry
    print("\n5. Building unified registry...")
    registry = OrderedDict()

    # Process HRAF societies (they form the base)
    for owc_id, hraf_data in hraf_societies.items():
        registry[owc_id] = {
            'hraf_name': hraf_data['hraf_name'],
            'hraf_summary': hraf_data['hraf_summary'],
            'region': hraf_data['region'],
            'societies': []
        }

    # Process SCCS societies
    for case_id, sccs_data in sccs_societies.items():
        hraf_owc = sccs_to_hraf.get(case_id, '')

        society = {
            'dataset': 'SCCS',
            'soc_id': f'SCCS{case_id}',
            'case_id': case_id,
            'xd_id': '',
            'pref_name': sccs_data['name'],
            'orig_name_id': '',
            'alt_names': [],
            'focal_year': sccs_data['year'],
            'latitude': sccs_data['latitude'],
            'longitude': sccs_data['longitude'],
            'glottocode': '',
            'glottocode_comment': '',
            'comment': ''
        }

        if hraf_owc and hraf_owc in registry:
            registry[hraf_owc]['societies'].append(society)
        else:
            # Create temporary entry for SCCS societies without HRAF match
            temp_id = f'sccs-{case_id}'
            if temp_id not in registry:
                registry[temp_id] = {
                    'hraf_name': '',
                    'hraf_summary': '',
                    'region': '',
                    'societies': []
                }
            registry[temp_id]['societies'].append(society)

    # Process EA societies
    for ea_id, ea_data in ea_societies.items():
        # First, try to match by OWC code
        owc_id = ea_data.get('owc', '')
        hraf_name_id = ea_data.get('hraf_name_id', '')

        # Extract OWC from hraf_name_id if present (e.g., "San (FX10)" -> "fx10")
        if hraf_name_id:
            match = re.search(r'\(([A-Z]{2}\d+)\)', hraf_name_id)
            if match:
                owc_id = match.group(1).lower()

        society = {
            'dataset': 'EA',
            'soc_id': ea_id,
            'case_id': '',
            'xd_id': ea_data['xd_id'],
            'pref_name': ea_data['pref_name'],
            'orig_name_id': ea_data['orig_name_id'],
            'alt_names': ea_data['alt_names'].split(',') if ea_data['alt_names'] else [],
            'focal_year': ea_data['focal_year'],
            'latitude': ea_data['latitude'],
            'longitude': ea_data['longitude'],
            'glottocode': ea_data['glottocode'],
            'glottocode_comment': ea_data['glottocode_comment'],
            'comment': ea_data['comment']
        }

        if owc_id and owc_id in registry:
            registry[owc_id]['societies'].append(society)
        else:
            # Create entry for EA societies without HRAF match
            temp_id = f'ea-{ea_id}'
            if temp_id not in registry:
                registry[temp_id] = {
                    'hraf_name': '',
                    'hraf_summary': '',
                    'region': '',
                    'societies': []
                }
            registry[temp_id]['societies'].append(society)

    # Print statistics
    print(f"\n6. Registry statistics:")
    total_groups = len(registry)
    total_societies = sum(len(g['societies']) for g in registry.values())
    hraf_groups = sum(1 for g in registry.values() if g['hraf_name'])

    print(f"  Total groups: {total_groups}")
    print(f"  Total societies: {total_societies}")
    print(f"  Groups with HRAF data: {hraf_groups}")

    # Count by dataset
    sccs_count = sum(
        sum(1 for s in g['societies'] if s['dataset'] == 'SCCS')
        for g in registry.values()
    )
    ea_count = sum(
        sum(1 for s in g['societies'] if s['dataset'] == 'EA')
        for g in registry.values()
    )
    print(f"  SCCS societies: {sccs_count}")
    print(f"  EA societies: {ea_count}")

    # Write output
    output_path = os.path.join(RES_DIR, 'owc_info_unified.json')
    print(f"\n7. Writing unified registry to {output_path}...")

    # Convert to list format for output
    output_data = {
        'metadata': {
            'total_groups': total_groups,
            'total_societies': total_societies,
            'hraf_groups': hraf_groups,
            'sccs_societies': sccs_count,
            'ea_societies': ea_count
        },
        'data': []
    }

    for group_id, group_data in registry.items():
        output_data['data'].append({
            'id': group_id,
            **group_data
        })

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"  Written {len(output_data['data'])} groups")

    # Also create a simplified lookup file for quick OWC -> society mapping
    lookup_path = os.path.join(RES_DIR, 'owc_lookup.json')
    print(f"\n8. Writing lookup file to {lookup_path}...")

    lookup = {}
    for group_id, group_data in registry.items():
        for society in group_data['societies']:
            lookup[society['soc_id']] = {
                'group_id': group_id,
                'hraf_name': group_data['hraf_name'],
                'pref_name': society['pref_name'],
                'dataset': society['dataset']
            }

    with open(lookup_path, 'w', encoding='utf-8') as f:
        json.dump(lookup, f, indent=2, ensure_ascii=False)

    print(f"  Written {len(lookup)} society lookups")

    print("\nDone!")


if __name__ == '__main__':
    build_unified_registry()
