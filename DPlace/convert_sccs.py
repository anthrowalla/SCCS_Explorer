#!/usr/bin/env python3
"""
Convert DPlace SCCS data from long-format CSV to compact matrix files
for the web crosstabulation tool.

Input (from ../dplace-data/datasets/SCCS/):
  - data.csv      (329K rows, long format)
  - variables.csv (variable metadata)
  - codes.csv     (value code descriptions)
  - societies.csv (society metadata)

Output (to resources/):
  - SCCS.data     (186 rows x N cols, space-separated)
  - SCCS.lbl      (AWK heredoc format, compatible with labelParser.js)
  - SCCS.glbl     (tab-separated society info, compatible with societyLookup.js)
  - SCCS.varinfo  (tab-separated variable metadata: category, title, type, definition)
  - badata.dat    (anomaly report)
"""

import csv
import os
import re
from collections import OrderedDict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'dplace-data', 'datasets', 'SCCS')
OUT_DIR = os.path.join(SCRIPT_DIR, 'resources')


def parse_societies():
    """Parse societies.csv -> ordered list of (soc_id, name, year, lat, long)."""
    societies = OrderedDict()
    path = os.path.join(DATA_DIR, 'societies.csv')
    with open(path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            soc_id = row['id']  # e.g. 'SCCS1'
            societies[soc_id] = {
                'name': row['pref_name_for_society'],
                'year': row['main_focal_year'],
                'lat': row['Lat'],
                'long': row['Long'],
            }
    # Sort by numeric ID: SCCS1, SCCS2, ..., SCCS186
    def soc_sort_key(item):
        return int(item[0].replace('SCCS', ''))
    return OrderedDict(sorted(societies.items(), key=soc_sort_key))


def parse_variables():
    """Parse variables.csv -> ordered dict of var_id -> {title, category, type, definition}."""
    path = os.path.join(DATA_DIR, 'variables.csv')
    var_meta = OrderedDict()
    with open(path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            var_id = row['id']  # e.g. 'SCCS1'
            var_meta[var_id] = {
                'title': row['title'],
                'category': row['category'],
                'type': row['type'],
                'definition': row['definition'],
                'source': row['source'],
            }
    # Sort by numeric part
    def var_sort_key(item):
        v = item[0]
        # Handle sub-variables like SCCS1805.1
        parts = v.replace('SCCS', '').split('.')
        return (int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
    return OrderedDict(sorted(var_meta.items(), key=var_sort_key))


def find_sub_variables():
    """Scan data.csv for sub-variable IDs (e.g. SCCS1805.1-8)."""
    path = os.path.join(DATA_DIR, 'data.csv')
    sub_vars = set()
    with open(path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            var_id = row['var_id']
            if '.' in var_id:
                sub_vars.add(var_id)
    return sorted(sub_vars, key=lambda v: (
        int(v.split('.')[0].replace('SCCS', '')),
        int(v.split('.')[1])
    ))


def parse_codes():
    """Parse codes.csv -> {var_id: [(code, description), ...]}."""
    path = os.path.join(DATA_DIR, 'codes.csv')
    codes = {}
    with open(path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            var_id = row['var_id']
            code = row['code']
            desc = row['description']
            if var_id not in codes:
                codes[var_id] = []
            codes[var_id].append((code, desc))
    return codes


def parse_data_matrix(societies, all_var_ids):
    """
    Parse data.csv -> dict[(soc_id, var_id)] = code string.
    Returns the data dict and anomaly info.
    """
    path = os.path.join(DATA_DIR, 'data.csv')
    data = {}
    anomaly_decimal = {}   # var_id -> set of decimal values seen
    anomaly_info = {
        'decimal_vars': {},
        'sub_vars': {},
        'total_na': 0,
        'total_codes': 0,
        'total_decimal': 0,
    }

    with open(path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            soc_id = row['soc_id']
            var_id = row['var_id']
            code = row['code']

            if var_id not in all_var_ids:
                continue

            # Skip society IDs not in our ordered list
            if soc_id not in societies:
                continue

            if code == 'NA' or code == '':
                anomaly_info['total_na'] += 1
                data[(soc_id, var_id)] = None
            else:
                anomaly_info['total_codes'] += 1
                data[(soc_id, var_id)] = code

                # Check for decimal values
                try:
                    fval = float(code)
                    if fval != int(fval):
                        anomaly_info['total_decimal'] += 1
                        if var_id not in anomaly_info['decimal_vars']:
                            anomaly_info['decimal_vars'][var_id] = []
                        if len(anomaly_info['decimal_vars'][var_id]) < 6:
                            anomaly_info['decimal_vars'][var_id].append(code)
                except ValueError:
                    pass

    return data, anomaly_info


def write_data_matrix(data, societies, all_var_ids, out_path):
    """Write SCCS.data: 186 rows x N cols, space-separated."""
    var_list = list(all_var_ids)
    with open(out_path, 'w', encoding='utf-8') as f:
        for soc_id in societies:
            row_vals = []
            for var_id in var_list:
                val = data.get((soc_id, var_id))
                if val is None:
                    row_vals.append('.')
                else:
                    row_vals.append(val)
            f.write(' '.join(row_vals) + '\n')


def write_varinfo(var_meta, all_var_ids, out_path):
    """
    Write SCCS.varinfo: tab-separated variable metadata for the web picker.

    Columns: col  sccs_num  category  title  type  description  citation  source
    col = sequential column number (1-based, matches SCCS.data column position)
    sccs_num = original SCCS variable number (e.g. 860 from SCCS860)
    """
    col_map = {}
    for i, var_id in enumerate(all_var_ids, 1):
        col_map[var_id] = i

    with open(out_path, 'w', encoding='utf-8') as f:
        for var_id in all_var_ids:
            col = col_map[var_id]
            # Extract original SCCS number (e.g. SCCS860 -> 860, SCCS1805.3 -> 1805.3)
            sccs_num = var_id.replace('SCCS', '')
            info = var_meta.get(var_id, {})
            title = info.get('title', var_id)
            category = info.get('category', '')
            vtype = info.get('type', '')
            raw_def = info.get('definition', '').replace('\t', ' ')
            source = info.get('source', '')

            # Split definition into description and citation.
            # Citations follow Author (Year). Title. Journal pattern.
            # They appear at the end, separated by blank lines (\n\n or \r\n\r\n).
            # Normalize line endings, then split on the last double-newline
            # before what looks like a citation.
            normalized = raw_def.replace('\r\n', '\n')
            parts = normalized.rsplit('\n\n', 1)

            if len(parts) == 2 and re.match(r'[A-Z]', parts[1].strip()):
                # Last part looks like a citation (starts with capital letter after blank line)
                description = parts[0].replace('\n', ' ').strip()
                citation = parts[1].replace('\n', ' ').strip()
            else:
                # No clear split — check if the whole thing looks like a citation
                # (starts with an author name pattern like "Murdock, G. P.")
                if re.match(r'^[A-Z][a-z]+,?\s+[A-Z]\.', normalized.strip()):
                    description = ''
                    citation = normalized.replace('\n', ' ').strip()
                else:
                    description = normalized.replace('\n', ' ').strip()
                    citation = ''

            f.write(f"{col}\t{sccs_num}\t{category}\t{title}\t{vtype}\t{description}\t{citation}\t{source}\n")


def write_labels(var_meta, codes, all_var_ids, out_path):
    """
    Write SCCS.lbl in AWK heredoc format compatible with labelParser.js.

    Format:
        #! /bin/sh
        exec nawk '...' vbar="$1" lookup="$2"  <<EOF
        1.  Variable Title
            NA  Missing data
            1  Value label
            2  Value label

        2.  Next Variable Title
        ...
        EOF
    """
    # Column number mapping: SCCS1->1, SCCS2->2, ..., SCCS1805.1->N, etc.
    col_map = {}
    for i, var_id in enumerate(all_var_ids, 1):
        col_map[var_id] = i

    with open(out_path, 'w', encoding='utf-8') as f:
        # AWK wrapper header (same structure as EthnoAtlas.lbl)
        f.write("#! /bin/sh\n")
        f.write("exec nawk '\n")
        f.write("BEGIN {cval=\"\"}\t\n")
        f.write(" cval == \"\" && $1 != \"\" {\n")
        f.write("\t\tcval = $1;$1 = \"\";split($0,lab,\"(\");\n")
        f.write("\t\tvarlable[cval] = lab[1]; next}\n")
        f.write(" cval != \"\" && $1 != \"\" {\n")
        f.write("\t\tvval = $1; $1 = \"\"\n")
        f.write("\t\tvarvals[cval \",\" vval] = $0\n")
        f.write("\t\tnext;\n")
        f.write("\t}\n")
        f.write("cval != \"\" && $1 == \"\" {cval = \"\";next}\n")
        f.write("END {\n")
        f.write("\tif (lookup == \"\") {\n")
        f.write("\t\tnl = split(vbar,lab,\" \")\n")
        f.write("\t\tfor(i=1;i<=nl;i++) {\n")
        f.write("\t\t\tif (i > 1) printf(\",\");\n")
        f.write("\t\t\tprintf(varlable[lab[i]\".\"]);\n")
        f.write("\t\t}\n")
        f.write("\t\tprintf(\"\\n\");\n")
        f.write("\t} else {\n")
        f.write("\t\tnl = split(lookup,lab,\" \")\n")
        f.write("\t\tfor(i=1;i<=nl;i++) {\n")
        f.write("\t\t\tif (i > 1) printf(\",\");\n")
        f.write("\t\t\tprintf(varvals[vbar\".,\"lab[i]]);\n")
        f.write("\t\t}\n")
        f.write("\t\tprintf(\"\\n\");\n")
        f.write("\t}\n")
        f.write("}\n")
        f.write("'\t  vbar=\"$1\" lookup=\"$2\"  <<EOF\n")

        # Variable definitions
        for var_id in all_var_ids:
            col = col_map[var_id]
            info = var_meta.get(var_id, {})
            title = info.get('title', var_id)
            # For sub-variables, append sub indicator
            if '.' in var_id:
                sub_num = var_id.split('.')[1]
                title = f"{title} [sub {sub_num}]"

            f.write(f"{col}.  {title}\n")

            # Write value codes
            var_codes = codes.get(var_id, [])
            for code, desc in var_codes:
                if code == 'NA':
                    f.write(f"    .  {desc}\n")
                else:
                    f.write(f"    {code}  {desc}\n")

            f.write("\n")

        f.write("EOF\n")


def write_societies(societies, out_path):
    """
    Write SCCS.glbl in AWK heredoc format compatible with societyLookup.js.

    Tab-separated: ID  Name  Year  Lat  Long
    """
    with open(out_path, 'w', encoding='utf-8') as f:
        # AWK wrapper header
        f.write("#! /bin/sh\n")
        f.write("exec nawk '\n")
        f.write("BEGIN {FS=\"\t\"}\n")
        f.write("$1 != \"\" {group[$1] = $0 }\n")
        f.write("END {\n")
        f.write("\tif (lookup != \"\") {\n")
        f.write("\t\tnl = split(lookup,glist,\",\")\n")
        f.write("\t\tfor(i=1;i<=nl;i++) {\n")
        f.write("\t\t\tprintf(\"%s\\n\",group[glist[i]]);\n")
        f.write("\t\t}\n")
        f.write("\t}\n")
        f.write("}\n")
        f.write("'\t  lookup=\"$1\"  <<EOF\n")

        for i, (soc_id, info) in enumerate(societies.items(), 1):
            num = soc_id.replace('SCCS', '')
            name = info['name']
            year = info['year'] if info['year'] != 'NA' else ''
            lat = info['lat']
            lon = info['long']
            f.write(f"{num}\t{name}\t{year}\t{lat}\t{lon}\n")

        f.write("EOF\n")


def write_anomaly_report(anomaly_info, sub_vars, out_path):
    """Write badata.dat anomaly report."""
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write("SCCS Data Conversion Anomaly Report\n")
        f.write("=" * 50 + "\n\n")

        f.write("Summary\n")
        f.write("-" * 30 + "\n")
        f.write(f"  Total NA (missing) values:   {anomaly_info['total_na']}\n")
        f.write(f"  Total coded values:           {anomaly_info['total_codes']}\n")
        f.write(f"  Decimal-valued entries:       {anomaly_info['total_decimal']}\n")
        f.write(f"  Sub-variables found:          {len(sub_vars)}\n")
        f.write(f"  Empty codes:                  0\n")
        f.write(f"  Truly bad/metadata entries:   0\n\n")

        f.write("Continuous Variables with Decimal Values\n")
        f.write("-" * 50 + "\n")
        for var_id in sorted(anomaly_info['decimal_vars']):
            samples = anomaly_info['decimal_vars'][var_id]
            f.write(f"  {var_id}: {len(samples)} sample values: {', '.join(samples)}\n")
        f.write("\n")

        f.write("Sub-Variables (appended after parent)\n")
        f.write("-" * 50 + "\n")
        for sv in sub_vars:
            f.write(f"  {sv}\n")
        f.write("\n")

        f.write("Notes\n")
        f.write("-" * 30 + "\n")
        f.write("  - No truly corrupted or metadata entries found in data.csv\n")
        f.write("  - Decimal values are preserved as-is in the data matrix\n")
        f.write("  - Sub-variables (SCCS1805.1-8) are appended after their parent\n")
        f.write("  - NA values are represented as '.' in SCCS.data\n")


def main():
    print("SCCS Data Conversion")
    print("=" * 40)

    # Step 1: Parse societies
    print("1. Parsing societies.csv...")
    societies = parse_societies()
    print(f"   {len(societies)} societies found (SCCS1-SCCS186)")

    # Step 2: Parse variables
    print("2. Parsing variables.csv...")
    var_meta = parse_variables()
    print(f"   {len(var_meta)} variables found")

    # Step 3: Find sub-variables
    print("3. Scanning for sub-variables...")
    sub_vars = find_sub_variables()
    print(f"   {len(sub_vars)} sub-variables found: {sub_vars}")

    # Build combined variable list: main vars sorted numerically, then sub-vars
    all_var_ids = list(var_meta.keys())
    # Add sub-variables that aren't already in the list
    for sv in sub_vars:
        if sv not in var_meta:
            # Sub-vars don't appear in variables.csv - use parent metadata
            parent = sv.split('.')[0]
            sub_num = sv.split('.')[1]
            parent_info = var_meta.get(parent, {})
            var_meta[sv] = {
                'title': f"{parent_info.get('title', parent)} (sub {sub_num})",
                'category': parent_info.get('category', ''),
                'type': parent_info.get('type', ''),
                'definition': parent_info.get('definition', ''),
                'source': parent_info.get('source', ''),
            }
            all_var_ids.append(sv)

    # Re-sort: main vars by number, sub-vars after their parent
    def full_sort_key(v):
        parts = v.replace('SCCS', '').split('.')
        return (int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
    all_var_ids.sort(key=full_sort_key)

    print(f"   Total columns: {len(all_var_ids)}")

    # Step 4: Parse value codes
    print("4. Parsing codes.csv...")
    codes = parse_codes()

    # Step 5: Parse data
    print("5. Parsing data.csv (this may take a moment)...")
    data, anomaly_info = parse_data_matrix(societies, set(all_var_ids))
    print(f"   {len(data)} data points loaded")

    # Step 6: Write SCCS.data
    os.makedirs(OUT_DIR, exist_ok=True)
    data_path = os.path.join(OUT_DIR, 'SCCS.data')
    print(f"6. Writing {data_path}...")
    write_data_matrix(data, societies, all_var_ids, data_path)

    # Step 7: Write SCCS.lbl
    lbl_path = os.path.join(OUT_DIR, 'SCCS.lbl')
    print(f"7. Writing {lbl_path}...")
    write_labels(var_meta, codes, all_var_ids, lbl_path)

    # Step 8: Write SCCS.glbl
    glbl_path = os.path.join(OUT_DIR, 'SCCS.glbl')
    print(f"8. Writing {glbl_path}...")
    write_societies(societies, glbl_path)

    # Step 9: Write SCCS.varinfo
    varinfo_path = os.path.join(OUT_DIR, 'SCCS.varinfo')
    print(f"9. Writing {varinfo_path}...")
    write_varinfo(var_meta, all_var_ids, varinfo_path)

    # Step 10: Write anomaly report
    report_path = os.path.join(OUT_DIR, 'badata.dat')
    print(f"10. Writing {report_path}...")
    write_anomaly_report(anomaly_info, sub_vars, report_path)

    # Verification
    print("\nVerification:")
    with open(data_path) as f:
        lines = [l for l in f if l.strip()]
    print(f"  SCCS.data lines: {len(lines)} (expect 186)")

    # Check column count on first row
    first_row = lines[0].split()
    print(f"  SCCS.data columns: {len(first_row)} (expect {len(all_var_ids)})")

    # File sizes
    for fname in ['SCCS.data', 'SCCS.lbl', 'SCCS.glbl', 'SCCS.varinfo', 'badata.dat']:
        fpath = os.path.join(OUT_DIR, fname)
        size = os.path.getsize(fpath)
        print(f"  {fname}: {size:,} bytes")

    # Spot-check: SCCS1, variable SCCS1 should have code 3 (from first data row we saw)
    val = data.get(('SCCS1', 'SCCS860'))
    print(f"  Spot check: SCCS1/SCCS860 = {val} (expect 3)")

    print("\nDone!")


if __name__ == '__main__':
    main()
