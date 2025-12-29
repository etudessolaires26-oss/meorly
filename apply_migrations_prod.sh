#!/bin/bash

# Configuration
DATABASE_ID="f430e736-45ec-4c40-9cb0-10eb2244d990"
ACCOUNT_ID="e6ae1cfa9d30a7db2aefbabb31b24579"
API_TOKEN="WMYIzyQMBnypdAeldm5ZCWsF4GwYhv5GygYoual0"

echo "🚀 Application des migrations sur la base D1 de production..."
echo "Database ID: $DATABASE_ID"
echo ""

# Lister toutes les migrations
for migration_file in migrations/*.sql; do
    migration_name=$(basename "$migration_file")
    echo "📄 Migration: $migration_name"
    
    # Lire le contenu du fichier SQL
    sql_content=$(cat "$migration_file")
    
    # Appliquer la migration via l'API Cloudflare D1
    response=$(curl -s -X POST \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DATABASE_ID/query" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{\"sql\": $(echo "$sql_content" | jq -Rs .)}")
    
    # Vérifier le résultat
    success=$(echo "$response" | jq -r '.success')
    
    if [ "$success" = "true" ]; then
        echo "✅ $migration_name appliquée avec succès"
    else
        echo "❌ Erreur lors de l'application de $migration_name"
        echo "$response" | jq -r '.errors[]'
    fi
    
    echo ""
done

echo "🎉 Toutes les migrations ont été traitées !"
