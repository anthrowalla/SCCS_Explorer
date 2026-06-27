#!/usr/bin/env python3
"""
Identify HRAF societies that don't have matching EA societies.
Generates ea_sccs_match.csv with HRAF code, name, lat/long for manual matching.
"""

import csv
import json
import os
import re
from difflib import SequenceMatcher

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'dplace-data', 'datasets', 'EA')
OUTPUT_PATH = os.path.join(SCRIPT_DIR, 'ea_sccs_match.csv')


def normalize_name(name):
    """Normalize name for comparison."""
    if not name:
        return ''
    # Remove extra whitespace
    name = ' '.join(name.split())
    # Convert to lowercase for comparison
    return name.lower()


def similarity(str1, str2):
    """Calculate string similarity ratio."""
    return SequenceMatcher(None, str1, str2).ratio()


def load_hraf_societies():
    """Load HRAF societies from hraf_owc_info.json."""
    path = os.path.join(SCRIPT_DIR, 'hraf_owc_info.json')
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    societies = {}
    for entry in data.get('data', []):
        owc_id = entry.get('id', '').lower()
        if owc_id:
            societies[owc_id] = {
                'owc_id': owc_id,
                'hraf_name': entry.get('term', ''),
                'sccs_group': entry.get('sccs_group', ''),
                'highest_bt': entry.get('highest_bt', ''),
                'bt': entry.get('bt', ''),
                'latitude': '',
                'longitude': ''
            }

    print(f"Loaded {len(societies)} HRAF societies from hraf_owc_info.json")
    return societies


def load_ea_societies():
    """Load EA societies from societies.csv."""
    path = os.path.join(DATA_DIR, 'societies.csv')
    societies = {}

    with open(path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            soc_id = row['id']
            pref_name = row.get('pref_name_for_society', '')
            orig_name = row.get('ORIG_name_and_ID_in_this_dataset', '')
            alt_names = row.get('alt_names_by_society', '')
            hraf_name_id = row.get('HRAF_name_ID', '')
            lat = row.get('Lat', '')
            lon = row.get('Long', '')

            # Extract OWC from HRAF_link
            hraf_link = row.get('HRAF_link', '')
            owc_match = re.search(r'owc=([A-Z]{2}\d+)', hraf_link, re.IGNORECASE)
            owc = owc_match.group(1).lower() if owc_match else ''

            # Collect all name variants for matching
            name_variants = [pref_name.lower()]
            if orig_name:
                # Extract just the name part (before the parenthesis)
                orig_name_only = re.sub(r'\s*\([^)]*\)', '', orig_name).strip()
                name_variants.append(orig_name_only.lower())
            if alt_names:
                for alt in alt_names.split(','):
                    alt = alt.strip()
                    if alt:
                        name_variants.append(alt.lower())

            societies[soc_id] = {
                'soc_id': soc_id,
                'pref_name': pref_name,
                'orig_name': orig_name,
                'alt_names': alt_names,
                'hraf_name_id': hraf_name_id,
                'owc': owc,
                'latitude': lat,
                'longitude': lon,
                'name_variants': name_variants
            }

    print(f"Loaded {len(societies)} EA societies from societies.csv")
    return societies


def match_societies(hraf_societies, ea_societies):
    """Match EA societies to HRAF societies."""
    matched_owc = set()
    matched_by_name = {}

    # First, match by OWC code (explicit links)
    for ea_id, ea_data in ea_societies.items():
        owc = ea_data['owc']
        if owc and owc in hraf_societies:
            matched_owc.add(owc)

    # Then, try name matching for unmatched HRAF societies
    for owc_id, hraf_data in hraf_societies.items():
        if owc_id in matched_owc:
            continue

        hraf_name = normalize_name(hraf_data['hraf_name'])
        hraf_sccs = hraf_data['sccs_group']

        # Try to match by name similarity
        best_match = None
        best_similarity = 0.7  # Threshold for name matching

        for ea_id, ea_data in ea_societies.items():
            for name_variant in ea_data['name_variants']:
                sim = similarity(hraf_name, name_variant)
                if sim > best_similarity:
                    best_similarity = sim
                    best_match = (ea_id, ea_data['pref_name'], name_variant)

        if best_match:
            matched_by_name[owc_id] = {
                'ea_id': best_match[0],
                'ea_name': best_match[1],
                'matched_name': best_match[2],
                'similarity': best_similarity
            }

    return matched_owc, matched_by_name


def main():
    print("Identifying HRAF societies without EA matches...")
    print("=" * 60)

    # Load societies
    hraf_societies = load_hraf_societies()
    ea_societies = load_ea_societies()

    # Match societies
    print("\nMatching EA to HRAF societies...")
    matched_owc, matched_by_name = match_societies(hraf_societies, ea_societies)

    print(f"  Matched by OWC code: {len(matched_owc)}")
    print(f"  Matched by name similarity: {len(matched_by_name)}")

    # Find unmatched HRAF societies
    unmatched = []
    for owc_id in sorted(hraf_societies.keys()):
        if owc_id not in matched_owc and owc_id not in matched_by_name:
            hraf = hraf_societies[owc_id]
            # Try to get lat/long from SCCS data if available
            lat = hraf['latitude']
            lon = hraf['longitude']

            # If sccs_group exists, try to get coordinates from SCCS
            if hraf['sccs_group'] and not lat:
                # Could look up in SCCS.glbl, but for now leave empty
                pass

            unmatched.append({
                'owc_id': owc_id.upper(),
                'hraf_name': hraf['hraf_name'],
                'sccs_group': hraf['sccs_group'],
                'highest_bt': hraf['highest_bt'],
                'bt': hraf['bt'],
                'latitude': lat,
                'longitude': lon
            })

    print(f"\nUnmatched HRAF societies: {len(unmatched)}")

    # Write CSV
    print(f"\nWriting to {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'owc_id', 'hraf_name', 'sccs_group', 'highest_bt', 'bt', 'latitude', 'longitude'
        ])
        writer.writeheader()
        for row in unmatched:
            writer.writerow(row)

    print(f"  Written {len(unmatched)} unmatched societies")

    # Also write potential matches for review
    if matched_by_name:
        match_log_path = os.path.join(SCRIPT_DIR, 'potential_matches.csv')
        print(f"\nWriting potential name matches to {match_log_path}...")
        with open(match_log_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'owc_id', 'hraf_name', 'ea_id', 'ea_name', 'matched_name', 'similarity'
            ])
            writer.writeheader()
            for owc_id, match_data in sorted(matched_by_name.items()):
                hraf = hraf_societies[owc_id]
                writer.writerow({
                    'owc_id': owc_id.upper(),
                    'hraf_name': hraf['hraf_name'],
                    'ea_id': match_data['ea_id'],
                    'ea_name': match_data['ea_name'],
                    'matched_name': match_data['matched_name'],
                    'similarity': f"{match_data['similarity']:.2f}"
                })

        print(f"  Written {len(matched_by_name)} potential matches")

    # Statistics
    print(f"\nStatistics:")
    print(f"  Total HRAF societies: {len(hraf_societies)}")
    print(f"  Matched by OWC code: {len(matched_owc)}")
    print(f"  Matched by name: {len(matched_by_name)}")
    print(f"  Unmatched: {len(unmatched)}")

    # Show some examples
    if unmatched:
        print(f"\nSample unmatched societies:")
        for u in unmatched[:10]:
            sccs_info = f" (SCCS {u['sccs_group']})" if u['sccs_group'] else ""
            print(f"  {u['owc_id']}: {u['hraf_name']}{sccs_info}")

    print("\nDone!")


if __name__ == '__main__':
    main()
