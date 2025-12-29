#!/bin/bash

echo "🧪 TEST WORKFLOW COMPLET - MEORLY"
echo "=================================="
echo ""

# 1. Inscription
echo "📝 ÉTAPE 1 : Inscription..."
INSCRIPTION_RESPONSE=$(curl -s -X POST https://meorly.pages.dev/api/inscription-step1 \
  -H "Content-Type: application/json" \
  -d '{
    "prenom": "Test",
    "nom": "Workflow",
    "email": "test.workflow@example.com",
    "tel": "+33612345678"
  }')

echo "Réponse: $INSCRIPTION_RESPONSE"
INSCRIPTION_ID=$(echo $INSCRIPTION_RESPONSE | grep -o '"inscription_id":[0-9]*' | grep -o '[0-9]*')
echo "✅ Inscription créée: ID #$INSCRIPTION_ID"
echo ""

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

echo "Réponse: $QUESTIONNAIRE_RESPONSE"
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

echo "Réponse: $RDV_RESPONSE"
echo "✅ RDV confirmé"
echo "📧 Email #1 (Confirmation RDV) devrait être envoyé !"
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

echo "Réponse: $PAYMENT_RESPONSE"
echo "✅ Paiement enregistré"
echo "📧 Email #2 (Demande paiement) devrait être envoyé !"
echo ""

# 5. Admin - Validate payment
echo "✅ ÉTAPE 5 : Validation paiement (Admin)..."
sleep 2
VALIDATE_RESPONSE=$(curl -s -X POST https://meorly.pages.dev/api/admin/validate-payment \
  -H "Content-Type: application/json" \
  -d "{
    \"inscription_id\": $INSCRIPTION_ID
  }")

echo "Réponse: $VALIDATE_RESPONSE"
echo "✅ Paiement validé"
echo "📧 Email #3 (Accès au parcours) devrait être envoyé !"
echo ""

echo "=================================="
echo "🎉 TEST TERMINÉ !"
echo ""
echo "VÉRIFICATIONS À FAIRE :"
echo "1. Vérifier l'email test.workflow@example.com"
echo "2. Devrait avoir reçu 3 emails :"
echo "   - Email #1 : Confirmation RDV"
echo "   - Email #2 : Demande paiement"
echo "   - Email #3 : Accès au parcours"
echo ""
echo "📊 Inscription ID: #$INSCRIPTION_ID"
echo "🔗 Dashboard admin: https://meorly.pages.dev/admin"
