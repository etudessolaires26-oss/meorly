#!/bin/bash
echo "🔍 Récupération de l'ID du domaine meorly.com dans Resend..."
echo ""

RESEND_API_KEY="re_ZRUsTotQ_3bcSHiNkr5W6Q9CcZwu1AzTB"

# Lister tous les domaines
RESPONSE=$(curl -s -X GET https://api.resend.com/domains \
  -H "Authorization: Bearer $RESEND_API_KEY")

echo "📋 Liste des domaines :"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Extraire l'ID du domaine meorly.com
DOMAIN_ID=$(echo "$RESPONSE" | jq -r '.data[] | select(.name == "meorly.com") | .id' 2>/dev/null)

if [ -n "$DOMAIN_ID" ] && [ "$DOMAIN_ID" != "null" ]; then
  echo "✅ ID du domaine meorly.com : $DOMAIN_ID"
  echo ""
  
  # Vérifier le domaine
  echo "🔄 Demande de vérification..."
  VERIFY_RESPONSE=$(curl -s -X POST "https://api.resend.com/domains/$DOMAIN_ID/verify" \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H "Content-Type: application/json")
  
  echo "Réponse :"
  echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"
else
  echo "❌ Domaine meorly.com non trouvé dans Resend"
fi
