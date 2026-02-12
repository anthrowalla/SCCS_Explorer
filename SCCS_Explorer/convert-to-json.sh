#!/bin/bash
# Convert EthnoAtlas data files to JSON format
# This creates a single JSON file that can be embedded in the HTML

cd "$(dirname "$0")/.."

echo "Converting EthnoAtlas data to JSON format..."

# Create the combined JSON file
cat >EthnoAtlas.json <<EOJSON
{
  "data": $(awk 'NF {print}' EthnoAtlas.data | jq -R -s -c 'split("\n") | map(split(" ") | map(tonumber? // .)) | map(select(length > 0))'),
  "labels": $(sed -n '/^1\./,/^EOF/p' EthnoAtlas.lbl | head -n -1 | jq -Rs -c 'split("\n") | map(select(length > 0) | select(startswith(".") | not) | select(startswith("exec") | not))'),
  "societies": $(tail -n +14 EthnoAtlas.glbl | head -n -1 | jq -R -s -c 'split("\n") | map(split("\t")) | map({id: (.[0] | tonumber), name: .[1], year: .[2], area: .[3]}) | map(select(.id))')
}
EOJSON

echo "JSON file created: EthnoAtlas.json"
echo "File size: $(wc -c <EthnoAtlas.json) bytes"
