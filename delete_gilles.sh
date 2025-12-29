#!/bin/bash

API_TOKEN="v0glpDXaIlYw9j9ACXdT8LSdlEr7H-hNv6TgMIHI"
ACCOUNT_ID="e6ae1cfa9d30a7db2aefbabb31b24579"
DATABASE_ID="f430e736-45ec-4c40-9cb0-10eb2244d990"

echo "🔍 Recherche de Gilles Benichou..."

# Rechercher par nom
RESULT=$(curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"sql": "SELECT id, prenom, nom, email FROM inscriptions WHERE nom LIKE '\''%benichou%'\'' OR nom LIKE '\''%Benichou%'\'' COLLATE NOCASE"}')

echo "$RESULT" | jq '.'

# Extraire l'ID si trouvé
INSCRIPTION_ID=$(echo "$RESULT" | jq -r '.result[0].results[0].id // empty')

if [ -z "$INSCRIPTION_ID" ]; then
  echo ""
  echo "❌ Aucune inscription trouvée pour Gilles Benichou"
  exit 1
fi

echo ""
echo "✅ Inscription trouvée : ID #$INSCRIPTION_ID"
echo ""
echo "🗑️ Suppression en cours..."

# Supprimer les données liées
echo "1. Suppression des manifestes..."
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"sql\": \"DELETE FROM manifestes WHERE inscription_id = $INSCRIPTION_ID\"}" > /dev/null

echo "2. Suppression des rendez-vous..."
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"sql\": \"DELETE FROM rendez_vous WHERE client_id = $INSCRIPTION_ID\"}" > /dev/null

echo "3. Suppression des messages..."
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"sql\": \"DELETE FROM messages WHERE inscription_id = $INSCRIPTION_ID\"}" > /dev/null

echo "4. Suppression de l'inscription..."
DELETE_RESULT=$(curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"sql\": \"DELETE FROM inscriptions WHERE id = $INSCRIPTION_ID\"}")

echo ""
echo "✅ Suppression terminée !"
echo ""
echo "Gilles Benichou peut maintenant se réinscrire sur :"
echo "https://meorly.pages.dev/inscription"
