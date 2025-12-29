#!/bin/bash
echo "🔄 Demande de vérification du domaine meorly.com dans Resend..."
echo ""

RESEND_API_KEY="re_ZRUsTotQ_3bcSHiNkr5W6Q9CcZwu1AzTB"

# Vérifier le domaine via l'API Resend
RESPONSE=$(curl -s -X POST https://api.resend.com/domains/meorly.com/verify \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json")

echo "Réponse Resend :"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# Vérifier le status du domaine
echo "📊 Status du domaine :"
curl -s -X GET https://api.resend.com/domains/meorly.com \
  -H "Authorization: Bearer $RESEND_API_KEY" | jq '.status' 2>/dev/null || echo "Erreur récupération status"
