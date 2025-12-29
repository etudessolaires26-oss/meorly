#!/bin/bash
echo "🧪 TEST CONNEXION CLIENT"
echo ""

EMAIL="academielumiere26@gmail.com"
PASSWORD="Welcometwfpnp!"

echo "🔐 Connexion avec :"
echo "   Email     : $EMAIL"
echo "   Password  : $PASSWORD"
echo ""

RESPONSE=$(curl -s -X POST https://meorly.pages.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "📊 Réponse API :"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

SUCCESS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)
INSCRIPTION_ID=$(echo "$RESPONSE" | jq -r '.user.inscription_id' 2>/dev/null)

if [ "$SUCCESS" = "true" ] && [ -n "$INSCRIPTION_ID" ] && [ "$INSCRIPTION_ID" != "null" ]; then
  echo "✅ Connexion réussie !"
  echo ""
  echo "📍 Redirection vers : /mon-parcours/$INSCRIPTION_ID"
  echo "🔗 URL complète : https://meorly.pages.dev/mon-parcours/$INSCRIPTION_ID"
  echo ""
  echo "🧪 Vous pouvez maintenant tester la connexion sur :"
  echo "   https://meorly.pages.dev/login"
else
  echo "❌ Erreur de connexion"
  echo "$RESPONSE" | jq '.error' 2>/dev/null
fi
