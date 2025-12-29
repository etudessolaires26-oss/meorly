#!/bin/bash
echo "🧪 TEST DIRECT de l'envoi d'email via Resend API..."
echo ""

RESEND_API_KEY="re_ZRUsTotQ_3bcSHiNkr5W6Q9CcZwu1AzTB"
FROM_EMAIL="academielumiere26@gmail.com"
TO_EMAIL="academielumiere26@gmail.com"
SUBJECT="TEST DIRECT - Confirmation RDV"
HTML_BODY="<h1>Test email</h1><p>Ceci est un test direct de l'API Resend.</p>"

echo "📧 Envoi d'un email de test..."
echo "   De      : $FROM_EMAIL"
echo "   À       : $TO_EMAIL"
echo "   Sujet   : $SUBJECT"
echo ""

RESPONSE=$(curl -s -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"from\": \"$FROM_EMAIL\",
    \"to\": [\"$TO_EMAIL\"],
    \"subject\": \"$SUBJECT\",
    \"html\": \"$HTML_BODY\"
  }")

echo "📊 Réponse Resend :"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Vérifier si l'email a été envoyé
EMAIL_ID=$(echo "$RESPONSE" | jq -r '.id' 2>/dev/null)
if [ -n "$EMAIL_ID" ] && [ "$EMAIL_ID" != "null" ]; then
  echo "✅ Email envoyé avec succès !"
  echo "   ID : $EMAIL_ID"
  echo ""
  echo "📧 Vérifiez votre boîte mail academielumiere26@gmail.com"
else
  echo "❌ Erreur lors de l'envoi"
  echo "$RESPONSE" | jq '.message' 2>/dev/null || echo "$RESPONSE"
fi
