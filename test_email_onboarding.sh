#!/bin/bash
echo "🧪 TEST avec onboarding@resend.dev"
echo ""

RESEND_API_KEY="re_ZRUsTotQ_3bcSHiNkr5W6Q9CcZwu1AzTB"
FROM_EMAIL="onboarding@resend.dev"
TO_EMAIL="academielumiere26@gmail.com"
SUBJECT="TEST - Confirmation RDV avec onboarding@resend.dev"
HTML_BODY="<h1>Test réussi !</h1><p>L'email est envoyé depuis onboarding@resend.dev</p>"

echo "📧 Envoi d'un email de test..."
echo "   De      : $FROM_EMAIL"
echo "   À       : $TO_EMAIL"
echo ""

RESPONSE=$(curl -s -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"from\": \"Académie de la Lumière <$FROM_EMAIL>\",
    \"to\": [\"$TO_EMAIL\"],
    \"subject\": \"$SUBJECT\",
    \"html\": \"$HTML_BODY\"
  }")

echo "📊 Réponse Resend :"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

EMAIL_ID=$(echo "$RESPONSE" | jq -r '.id' 2>/dev/null)
if [ -n "$EMAIL_ID" ] && [ "$EMAIL_ID" != "null" ]; then
  echo "✅✅✅ EMAIL ENVOYÉ AVEC SUCCÈS ! ✅✅✅"
  echo ""
  echo "📧 Vérifiez votre boîte academielumiere26@gmail.com"
  echo "   Expéditeur : Académie de la Lumière <onboarding@resend.dev>"
  echo "   Sujet : $SUBJECT"
else
  echo "❌ Erreur : $(echo "$RESPONSE" | jq -r '.message' 2>/dev/null)"
fi
