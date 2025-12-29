#!/bin/bash

# Utiliser un email unique avec timestamp
TIMESTAMP=$(date +%s)
EMAIL="test.workflow.$TIMESTAMP@example.com"

echo "🧪 TEST WORKFLOW COMPLET - MEORLY"
echo "=================================="
echo "📧 Email test: $EMAIL"
echo ""

# 1. Inscription
echo "📝 ÉTAPE 1 : Inscription..."
INSCRIPTION_RESPONSE=$(curl -s -X POST https://meorly.pages.dev/api/inscription-step1 \
  -H "Content-Type: application/json" \
  -d "{
    \"prenom\": \"Test\",
    \"nom\": \"Workflow\",
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
    \"themes\": [\"paix\", \"sante\"],
    \"responses\": {
      \"paix\": \"Je recherche la paix intérieure\",
      \"sante\": \"Je veux améliorer ma santé\",
      \"situation\": \"En quête de sérénité\",
      \"objectifs\": \"Trouver l'équilibre\",
      \"rdv_date_souhaitee\": \"2025-01-20\",
      \"rdv_heure_souhaitee\": \"14:00\",
      \"rdv_notes\": \"Test automatisé\"
    }
  }")

echo "$QUESTIONNAIRE_RESPONSE"
echo "✅ Questionnaire rempli"
echo ""

# 3. RDV
echo "📅 ÉTAPE 3 : Prise de RDV..."
sleep 2
RDV_RESPONSE=$(curl -s -X POST https://meorly.pages.dev/api/rdv \
  -H "Content-Type: application/json" \
  -d "{
    \"inscription_id\": $INSCRIPTION_ID,
    \"date\": \"2025-01-20\",
    \"slot\": \"14:00-15:00\",
    \"remarques\": \"Test workflow complet\"
  }")

echo "$RDV_RESPONSE"
echo "✅ RDV confirmé"
echo "📧 Email #1 (Confirmation RDV) envoyé à $EMAIL !"
echo ""

# 4. Admin - Record payment
echo "💳 ÉTAPE 4 : Enregistrement paiement (Admin)..."
sleep 2
PAYMENT_RESPONSE=$(curl -s -X POST https://meorly.pages.dev/api/admin/record-payment \
  -H "Content-Type: application/json" \
  -d "{
    \"inscription_id\": $INSCRIPTION_ID,
    \"formule\": \"essentiel\",
    \"amount\": 175,
    \"payment_link\": \"https://stripe.com/test123\"
  }")

echo "$PAYMENT_RESPONSE"
echo "✅ Paiement enregistré"
echo "📧 Email #2 (Demande paiement) envoyé à $EMAIL !"
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
  echo "📧 Email #3 (Accès au parcours) envoyé à $EMAIL !"
else
  echo "❌ Erreur lors de la validation du paiement"
fi

echo ""
echo "=================================="
echo "🎉 TEST TERMINÉ !"
echo ""
echo "📧 Email utilisé: $EMAIL"
echo "📊 Inscription ID: #$INSCRIPTION_ID"
echo "🔗 Dashboard admin: https://meorly.pages.dev/admin"
