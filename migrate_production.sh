#!/bin/bash

API_TOKEN="FUJhmoL9zjRCKV8bQl8L0p5Pf8dGBoLHIgDLiu7i"
ACCOUNT_ID="e6ae1cfa9d30a7db2aefbabb31b24579"
DATABASE_ID="f430e736-45ec-4c40-9cb0-10eb2244d990"

echo "🚀 Application des migrations sur meorly-production..."
echo ""

# Fonction pour appliquer une migration
apply_migration() {
    local file=$1
    local name=$(basename "$file")
    
    echo "📄 Migration: $name"
    
    # Lire le SQL (en échappant les caractères spéciaux pour JSON)
    local sql=$(cat "$file" | jq -Rs .)
    
    # Envoyer à l'API Cloudflare D1
    local response=$(curl -s -X POST \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DATABASE_ID/query" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"sql\": $sql}")
    
    # Vérifier le résultat
    local success=$(echo "$response" | jq -r '.success // false')
    
    if [ "$success" = "true" ]; then
        echo "✅ $name - OK"
    else
        echo "❌ $name - ERREUR"
        echo "$response" | jq -r '.errors[]? | .message' 2>/dev/null || echo "$response"
    fi
    echo ""
}

# Appliquer toutes les migrations dans l'ordre
for migration in migrations/*.sql; do
    apply_migration "$migration"
done

echo "🎉 Migrations terminées !"
