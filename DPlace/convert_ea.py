#!/usr/bin/env python3
"""
Convert DPlace EA data from long-format CSV to compact matrix files
for the web crosstabulation tool.

Input (from ../dplace-data/datasets/EA/):
  - data.csv      (long format)
  - variables.csv (variable metadata)
  - codes.csv     (value code descriptions)
  - societies.csv (society metadata)

Output (to resources/):
  - EA.data       (N rows x M cols, space-separated)
  - EA.lbl        (AWK heredoc format, compatible with labelParser.js)
  - EA.glbl       (tab-separated society info, compatible with societyLookup.js)
  - EA.varinfo    (tab-separated variable metadata: category, title, type, definition)
  - EA.owc        (society OWC registry)
"""

import csv
import os
import re
from collections import OrderedDict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'dplace-data', 'datasets', 'EA')
OUT_DIR = os.path.join(SCRIPT_DIR, 'resources')


def parse_societies():
    """Parse societies.csv -> ordered list of (soc_id, name, year, lat, long, owc, etc.)."""
    societies = OrderedDict()
    path = os.path.join(DATA_DIR, 'societies.csv')
    with open(path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            soc_id = row['id']  # e.g. 'EA001'
            # Extract numeric ID for sorting
            num_match = re.search(r'\d+', soc_id)
            num_id = int(num_match.group()) if num_match else 0

            societies[soc_id] = {
                'num_id': num_id,
                'name': row.get('pref_name_for_society', row.get('pref_name', '')),
                'orig_name': row.get('original_name_for_society', row.get('orig_name_id', '')),
                'alt_names': row.get('alternate_names', ''),
                'year': row.get('main_focal_year', ''),
                'lat': row.get('Lat', ''),
                'long': row.get('Long', ''),
                'xd_id': row.get('xd_id', ''),
                'owc': row.get('OWC', ''),
                'glottocode': row.get('glottocode', ''),
                'glottocode_comment': row.get('glottocode_comment', ''),
                'comment': row.get('comment', ''),
            }
    # Sort by numeric ID
    return OrderedDict(sorted(societies.items(), key=lambda x: x[1]['num_id']))


def parse_variables():
    """Parse variables.csv -> ordered dict of var_id -> {title, category, type, definition}."""
    path = os.path.join(DATA_DIR, 'variables.csv')
    var_meta = OrderedDict()
    with open(path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            var_id = row['id']  # e.g. 'EA001'
            # Extract numeric ID for sorting
            num_match = re.search(r'\d+', var_id)
            num_id = int(num_match.group()) if num_match else 0

            var_meta[var_id] = {
                'num_id': num_id,
                'title': row['title'],
                'category': row.get('category', ''),
                'type': row.get('type', ''),
                'definition': row.get('definition', ''),
                'source': row.get('source', ''),
            }
    # Sort by numeric part
    return OrderedDict(sorted(var_meta.items(), key=lambda x: x[1]['num_id']))


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
    anomaly_info = {
        'total_na': 0,
        'total_codes': 0,
        'total_decimal': 0,
        'decimal_vars': {},
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

            if code == 'NA' or code == '' or code == '.':
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
    """Write EA.data: N rows x M cols, space-separated."""
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
    Write EA.varinfo: tab-separated variable metadata for the web picker.

    Columns: col  ea_num  category  title  type  description  citation  source
    col = sequential column number (1-based, matches EA.data column position)
    ea_num = original EA variable number (e.g. 1 from EA001)
    """
    col_map = {}
    for i, var_id in enumerate(all_var_ids, 1):
        col_map[var_id] = i

    with open(out_path, 'w', encoding='utf-8') as f:
        for var_id in all_var_ids:
            col = col_map[var_id]
            # Extract original EA number (e.g. EA001 -> 1)
            ea_num = re.search(r'\d+', var_id)
            ea_num = ea_num.group() if ea_num else var_id

            info = var_meta.get(var_id, {})
            title = info.get('title', var_id)
            category = info.get('category', '')
            vtype = info.get('type', '')
            raw_def = info.get('definition', '').replace('\t', ' ')
            source = info.get('source', '')

            # Split definition into description and citation.
            # Citations follow Author (Year). Title. Journal pattern.
            # They appear at the end, separated by blank lines (\n\n or \r\n\r\n).
            normalized = raw_def.replace('\r\n', '\n')
            parts = normalized.rsplit('\n\n', 1)

            if len(parts) == 2 and re.match(r'[A-Z]', parts[1].strip()):
                # Last part looks like a citation (starts with capital letter after blank line)
                description = parts[0].replace('\n', ' ').strip()
                citation = parts[1].replace('\n', ' ').strip()
            else:
                # No clear split — check if the whole thing looks like a citation
                if re.match(r'^[A-Z][a-z]+,?\s+[A-Z]\.', normalized.strip()):
                    description = ''
                    citation = normalized.replace('\n', ' ').strip()
                else:
                    description = normalized.replace('\n', ' ').strip()
                    citation = ''

            f.write(f"{col}\t{ea_num}\t{category}\t{title}\t{vtype}\t{description}\t{citation}\t{source}\n")


def write_labels(var_meta, codes, all_var_ids, out_path):
    """
    Write EA.lbl in AWK heredoc format compatible with labelParser.js.

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
    # Column number mapping: EA001->1, EA002->2, etc.
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
    Write EA.glbl in AWK heredoc format compatible with societyLookup.js.

    Tab-separated: ID  Name  Year  Lat  Long  OWC  xd_id
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

        for soc_id, info in societies.items():
            # Use the numeric ID for the first column
            num = info['num_id']
            name = info['name']
            year = info['year'] if info['year'] and info['year'] != 'NA' else ''
            lat = info['lat']
            lon = info['long']
            owc = info['owc']
            xd_id = info['xd_id']
            f.write(f"{num}\t{name}\t{year}\t{lat}\t{lon}\t{owc}\t{xd_id}\n")

        f.write("EOF\n")


def write_owc_registry(societies, out_path):
    """
    Write EA.owc: Society OWC registry for cross-dataset lookup.

    Format: JSON-like text format (one society per line)
    num_id\tname\towc\txd_id\talt_names\tglottocode\tglottocode_comment\tcomment
    """
    with open(out_path, 'w', encoding='utf-8') as f:
        for soc_id, info in societies.items():
            num = info['num_id']
            name = info['name']
            owc = info['owc']
            xd_id = info['xd_id']
            alt_names = info['alt_names']
            glottocode = info['glottocode']
            glottocode_comment = info['glottocode_comment']
            comment = info['comment']
            f.write(f"{num}\t{name}\t{owc}\t{xd_id}\t{alt_names}\t{glottocode}\t{glottocode_comment}\t{comment}\n")


def write_anomaly_report(anomaly_info, out_path):
    """Write EA anomaly report."""
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write("EA Data Conversion Anomaly Report\n")
        f.write("=" * 50 + "\n\n")

        f.write("Summary\n")
        f.write("-" * 30 + "\n")
        f.write(f"  Total NA (missing) values:   {anomaly_info['total_na']}\n")
        f.write(f"  Total coded values:           {anomaly_info['total_codes']}\n")
        f.write(f"  Decimal-valued entries:       {anomaly_info['total_decimal']}\n\n")

        f.write("Continuous Variables with Decimal Values\n")
        f.write("-" * 50 + "\n")
        for var_id in sorted(anomaly_info['decimal_vars']):
            samples = anomaly_info['decimal_vars'][var_id]
            f.write(f"  {var_id}: {len(samples)} sample values: {', '.join(samples)}\n")
        f.write("\n")

        f.write("Notes\n")
        f.write("-" * 30 + "\n")
        f.write("  - NA values are represented as '.' in EA.data\n")
        f.write("  - Decimal values are preserved as-is in the data matrix\n")


def main():
    print("EA Data Conversion")
    print("=" * 40)

    # Step 1: Parse societies
    print("1. Parsing societies.csv...")
    societies = parse_societies()
    print(f"   {len(societies)} societies found")

    # Step 2: Parse variables
    print("2. Parsing variables.csv...")
    var_meta = parse_variables()
    print(f"   {len(var_meta)} variables found")

    # Build variable list (sorted by numeric ID)
    all_var_ids = list(var_meta.keys())
    all_var_ids.sort(key=lambda v: var_meta[v]['num_id'])

    print(f"   Total columns: {len(all_var_ids)}")

    # Step 3: Parse value codes
    print("3. Parsing codes.csv...")
    codes = parse_codes()

    # Step 4: Parse data
    print("4. Parsing data.csv (this may take a moment)...")
    data, anomaly_info = parse_data_matrix(societies, set(all_var_ids))
    print(f"   {len(data)} data points loaded")

    # Step 5: Write EA.data
    os.makedirs(OUT_DIR, exist_ok=True)
    data_path = os.path.join(OUT_DIR, 'EA.data')
    print(f"5. Writing {data_path}...")
    write_data_matrix(data, societies, all_var_ids, data_path)

    # Step 6: Write EA.lbl
    lbl_path = os.path.join(OUT_DIR, 'EA.lbl')
    print(f"6. Writing {lbl_path}...")
    write_labels(var_meta, codes, all_var_ids, lbl_path)

    # Step 7: Write EA.glbl
    glbl_path = os.path.join(OUT_DIR, 'EA.glbl')
    print(f"7. Writing {glbl_path}...")
    write_societies(societies, glbl_path)

    # Step 8: Write EA.varinfo
    varinfo_path = os.path.join(OUT_DIR, 'EA.varinfo')
    print(f"8. Writing {varinfo_path}...")
    write_varinfo(var_meta, all_var_ids, varinfo_path)

    # Step 9: Write EA.owc
    owc_path = os.path.join(OUT_DIR, 'EA.owc')
    print(f"9. Writing {owc_path}...")
    write_owc_registry(societies, owc_path)

    # Step 10: Write anomaly report
    report_path = os.path.join(OUT_DIR, 'EA_anomaly.dat')
    print(f"10. Writing {report_path}...")
    write_anomaly_report(anomaly_info, report_path)

    # Verification
    print("\nVerification:")
    with open(data_path) as f:
        lines = [l for l in f if l.strip()]
    print(f"  EA.data lines: {len(lines)} (societies)")

    # Check column count on first row
    first_row = lines[0].split()
    print(f"  EA.data columns: {len(first_row)} (variables)")

    # File sizes
    for fname in ['EA.data', 'EA.lbl', 'EA.glbl', 'EA.varinfo', 'EA.owc', 'EA_anomaly.dat']:
        fpath = os.path.join(OUT_DIR, fname)
        size = os.path.getsize(fpath)
        print(f"  {fname}: {size:,} bytes")

    print("\nDone!")


if __name__ == '__main__':
    main()
