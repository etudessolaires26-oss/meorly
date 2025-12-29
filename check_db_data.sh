#!/bin/bash

API_TOKEN="v0glpDXaIlYw9j9ACXdT8LSdlEr7H-hNv6TgMIHI"
ACCOUNT_ID="e6ae1cfa9d30a7db2aefbabb31b24579"
DATABASE_ID="f430e736-45ec-4c40-9cb0-10eb2244d990"

echo "🔍 Vérification des données dans D1 Production..."
echo ""

# Compter Peteks
echo "📿 PETEK_TEMPLATES:"
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"sql": "SELECT COUNT(*) as count FROM petek_templates"}' | jq -r '.result[0].results[0].count // "Error"'

# Compter Psalms
echo "📖 PSALMS:"
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"sql": "SELECT COUNT(*) as count FROM psalms"}' | jq -r '.result[0].results[0].count // "Error"'

# Compter Angels
echo "👼 ANGELS:"
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"sql": "SELECT COUNT(*) as count FROM angels"}' | jq -r '.result[0].results[0].count // "Error"'

echo ""
echo "=================================="
