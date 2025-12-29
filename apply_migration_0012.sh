#!/bin/bash

API_TOKEN="v0glpDXaIlYw9j9ACXdT8LSdlEr7H-hNv6TgMIHI"
ACCOUNT_ID="e6ae1cfa9d30a7db2aefbabb31b24579"
DATABASE_ID="f430e736-45ec-4c40-9cb0-10eb2244d990"

echo "🔧 Application de la migration 0012_user_progress_system.sql..."

# Lire le fichier SQL
SQL=$(cat migrations/0012_user_progress_system.sql)

# Appliquer via l'API
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"sql\": \"${SQL}\"}"

echo ""
echo "✅ Migration 0012 appliquée !"
