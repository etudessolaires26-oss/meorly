#!/bin/bash

# Utiliser un email réel
EMAIL="bensimonphilippe+test$(date +%s)@yahoo.fr"

echo "🧪 TEST WORKFLOW COMPLET - AVEC EMAIL RÉEL"
echo "=========================================="
echo "📧 Email test: $EMAIL"
echo ""

# 1. Inscription
echo "📝 ÉTAPE 1 : Inscription..."
INSCRIPTION_RESPONSE=$(curl -s -X POST https://meorly.pages.dev/api/inscription-step1 \
  -H "Content-Type: application/json" \
  -d "{
    \"prenom\": \"Philippe\",
    \"nom\": \"Bensimon\",
    \"email\": \"$EMAIL\",
    \"tel\": \"+33612345678\"
  }")

echo "$INSCRIPTION_RESPONSE"
INSCRIPTION_ID=$(echo $INSCRIPTION_RESPONSE | grep -o '"inscription_id":[0-9]*' | grep -o '[0-9]*')
echo "✅ Inscription créée: ID #$INSCRIPTION_ID"
echo ""

if [ -z "$INSCRIPTION_ID" ]; then
  echo "❌ Erreur: inscription_id vide"
  exit 1
fi

# 2. Questionnaire
echo "📋 ÉTAPE 2 : Questionnaire..."
sleep 2
QUESTIONNAIRE_RESPONSE=$(curl -s -X POST https://meorly.pages.dev/api/questionnaire \
  -H "Content-Type: application/json" \
  -d "{
    \"inscription_id\": $INSCRIPTION_ID,
    \"themes\": [\"paix\", \"prosperite\"],
    \"responses\": {
      \"paix\": \"Je recherche la paix intérieure\",
      \"prosperite\": \"Je veux prospérer\",
      \"situation\": \"En quête spirituelle\",
      \"objectifs\": \"Trouver l'équilibre et la prospérité\",
      \"rdv_date_souhaitee\": \"2025-01-25\",
      \"rdv_heure_souhaitee\": \"15:00\",
      \"rdv_notes\": \"Test réel\"
    }
  }")

echo "$QUESTIONNAIRE_RESPONSE"
echo ""

# 3. RDV
echo "📅 ÉTAPE 3 : Prise de RDV..."
sleep 2
RDV_RESPONSE=$(curl -s -X POST https://meorly.pages.dev/api/rdv \
  -H "Content-Type: application/json" \
  -d "{
    \"inscription_id\": $INSCRIPTION_ID,
    \"date\": \"2025-01-25\",
    \"slot\": \"15:00-16:00\",
    \"remarques\": \"Test avec email réel\"
  }")

echo "$RDV_RESPONSE"
echo ""

# 4. Admin - Record payment
echo "💳 ÉTAPE 4 : Enregistrement paiement (Admin)..."
sleep 2
PAYMENT_RESPONSE=$(curl -s -X POST https://meorly.pages.dev/api/admin/record-payment \
  -H "Content-Type: application/json" \
  -d "{
    \"inscription_id\": $INSCRIPTION_ID,
    \"formule\": \"psaumes\",
    \"amount\": 495,
    \"payment_link\": \"https://stripe.com/payment/test-reel\"
  }")

echo "$PAYMENT_RESPONSE"
echo ""

# 5. Admin - Validate payment
echo "✅ ÉTAPE 5 : Validation paiement (Admin)..."
sleep 2
VALIDATE_RESPONSE=$(curl -s -X POST https://meorly.pages.dev/api/admin/validate-payment \
  -H "Content-Type: application/json" \
  -d "{
    \"inscription_id\": $INSCRIPTION_ID
  }")

echo "$VALIDATE_RESPONSE"
echo ""

if echo "$VALIDATE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Paiement validé avec succès !"
  echo ""
  echo "🔑 IDENTIFIANTS DE CONNEXION :"
  echo "   Email: $EMAIL"
  echo "   Mot de passe: $(echo $VALIDATE_RESPONSE | grep -o '"temp_password":"[^"]*"' | cut -d'"' -f4)"
  echo ""
  echo "📧 VÉRIFIEZ VOS EMAILS (3 emails devraient être envoyés) :"
  echo "   1. Confirmation RDV"
  echo "   2. Demande de paiement"
  echo "   3. Accès au parcours"
else
  echo "❌ Erreur lors de la validation du paiement"
fi

echo ""
echo "=========================================="
echo "📊 Inscription ID: #$INSCRIPTION_ID"
echo "🔗 Login: https://meorly.pages.dev/login"
echo "🔗 Dashboard admin: https://meorly.pages.dev/admin"
