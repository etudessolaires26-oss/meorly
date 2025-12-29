#!/bin/bash
echo "📊 Vérification des emails envoyés via Resend..."
echo ""

RESEND_API_KEY="re_ZRUsTotQ_3bcSHiNkr5W6Q9CcZwu1AzTB"

# Récupérer les derniers emails envoyés
RESPONSE=$(curl -s -X GET "https://api.resend.com/emails?limit=10" \
  -H "Authorization: Bearer $RESEND_API_KEY")

echo "📧 Derniers emails envoyés :"
echo "$RESPONSE" | jq '.data[] | {id, to, subject, created_at, last_event}' 2>/dev/null || echo "$RESPONSE"
echo ""

# Chercher spécifiquement l'email vers academielumiere26@gmail.com
echo "🔍 Recherche d'emails vers academielumiere26@gmail.com..."
echo "$RESPONSE" | jq '.data[] | select(.to[0] == "academielumiere26@gmail.com")' 2>/dev/null || echo "Aucun email trouvé"
