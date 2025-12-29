#!/bin/bash
echo "🧪 TEST WORKFLOW ADMIN - Emails #2 et #3"
echo ""

INSCRIPTION_ID=22

echo "📋 Inscription ID : #$INSCRIPTION_ID"
echo ""

# Étape 4 : Saisir paiement (Admin)
echo "4️⃣ Étape 4 : Saisir paiement (Admin)..."
RESPONSE4=$(curl -s -X POST https://meorly.pages.dev/api/admin/record-payment \
  -H "Content-Type: application/json" \
  -d "{
    \"inscription_id\": $INSCRIPTION_ID,
    \"formule\": \"essentiel\",
    \"amount\": 175,
    \"payment_link\": \"https://stripe.com/test_workflow\"
  }")

echo "$RESPONSE4" | grep -q '"success":true' && echo "✅ Paiement enregistré - Email #2 envoyé !" || echo "❌ Erreur paiement"
echo ""

# Attendre 2 secondes
sleep 2

# Étape 5 : Valider paiement (Admin)
echo "5️⃣ Étape 5 : Valider paiement (Admin)..."
RESPONSE5=$(curl -s -X POST https://meorly.pages.dev/api/admin/validate-payment \
  -H "Content-Type: application/json" \
  -d "{\"inscription_id\": $INSCRIPTION_ID}")

echo "$RESPONSE5" | grep -q '"success":true' && echo "✅ Paiement validé - Email #3 envoyé !" || echo "❌ Erreur validation"
echo ""

# Récupérer les détails du compte créé
USER_ID=$(echo "$RESPONSE5" | grep -o '"user_id":[0-9]*' | grep -o '[0-9]*')
TEMP_PASSWORD=$(echo "$RESPONSE5" | grep -o '"temp_password":"[^"]*"' | cut -d'"' -f4)

if [ -n "$USER_ID" ] && [ -n "$TEMP_PASSWORD" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔑 COMPTE CRÉÉ !"
  echo ""
  echo "   User ID       : $USER_ID"
  echo "   Email         : academielumiere26@gmail.com"
  echo "   Mot de passe  : $TEMP_PASSWORD"
  echo "   Login URL     : https://meorly.pages.dev/login"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo ""
echo "📧 VÉRIFICATION GMAIL :"
echo "   1) Allez sur https://mail.google.com"
echo "   2) Connectez-vous : academielumiere26@gmail.com"
echo "   3) Vous devriez voir 3 emails :"
echo ""
echo "      ✅ Email #1 : ✨ Confirmation de votre rendez-vous"
echo "      ⏳ Email #2 : 💳 Votre parcours spirituel vous attend"
echo "      ⏳ Email #3 : ✨ Bienvenue à l'Académie - Vos identifiants"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vérifier dans Resend
echo ""
echo "🔍 Vérification Resend API..."
sleep 2

RESEND_API_KEY="re_ZRUsTotQ_3bcSHiNkr5W6Q9CcZwu1AzTB"
RESEND_RESPONSE=$(curl -s -X GET "https://api.resend.com/emails?limit=5" \
  -H "Authorization: Bearer $RESEND_API_KEY")

echo ""
echo "📊 Derniers emails envoyés (Resend) :"
echo "$RESEND_RESPONSE" | jq '.data[] | {to: .to[0], subject, created_at}' 2>/dev/null | head -15

echo ""
echo "✅ Test terminé !"
