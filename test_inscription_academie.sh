#!/bin/bash
echo "🧪 TEST INSCRIPTION - academielumiere26@gmail.com"
echo ""

# Variables
EMAIL="academielumiere26@gmail.com"
TIMESTAMP=$(date +%s)
TEST_EMAIL="academie.test.$TIMESTAMP@gmail.com"

echo "📧 Email de test : $TEST_EMAIL"
echo ""

# Étape 1 : Inscription
echo "1️⃣ Étape 1 : Inscription..."
RESPONSE1=$(curl -s -X POST https://meorly.pages.dev/api/inscription-step1 \
  -H "Content-Type: application/json" \
  -d "{
    \"prenom\": \"Test\",
    \"nom\": \"Académie\",
    \"email\": \"$EMAIL\",
    \"tel\": \"+33600000000\"
  }")

INSCRIPTION_ID=$(echo "$RESPONSE1" | grep -o '"inscription_id":[0-9]*' | grep -o '[0-9]*')
echo "✅ Inscription créée : ID #$INSCRIPTION_ID"
echo ""

# Étape 2 : Questionnaire
echo "2️⃣ Étape 2 : Questionnaire..."
curl -s -X POST https://meorly.pages.dev/api/questionnaire \
  -H "Content-Type: application/json" \
  -d "{
    \"inscription_id\": $INSCRIPTION_ID,
    \"themes\": [\"Paix intérieure\", \"Amour\"],
    \"theme_autre\": \"\",
    \"situation\": \"Test du système d'emails\",
    \"objectifs\": \"Vérifier que les emails arrivent bien\",
    \"rdv_date_souhaitee\": \"2025-01-30\",
    \"rdv_heure_souhaitee\": \"Matin (9h-12h)\",
    \"remarques\": \"Test final système Resend\"
  }" > /dev/null

echo "✅ Questionnaire rempli"
echo ""

# Étape 3 : RDV
echo "3️⃣ Étape 3 : Prise de RDV..."
RESPONSE3=$(curl -s -X POST https://meorly.pages.dev/api/rdv \
  -H "Content-Type: application/json" \
  -d "{
    \"inscription_id\": $INSCRIPTION_ID,
    \"date\": \"2025-01-30\",
    \"slot\": \"matin\",
    \"remarques\": \"Test final\"
  }")

echo "$RESPONSE3" | grep -q '"success":true' && echo "✅ RDV confirmé - Email #1 envoyé !" || echo "❌ Erreur RDV"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📧 VÉRIFICATION :"
echo "   1) Allez sur https://mail.google.com"
echo "   2) Connectez-vous avec : academielumiere26@gmail.com"
echo "   3) Cherchez l'email : '✨ Confirmation de votre rendez-vous'"
echo "   4) Expéditeur : academielumiere26@gmail.com"
echo ""
echo "📋 Inscription ID : #$INSCRIPTION_ID"
echo "🔗 Dashboard admin : https://meorly.pages.dev/admin"
echo ""
echo "🎯 PROCHAINES ÉTAPES ADMIN :"
echo "   1) Connexion : admin@academie-lumiere.fr / Admin123!"
echo "   2) Trouver inscription #$INSCRIPTION_ID"
echo "   3) Cliquer : ✅ Contacter → 💳 Saisir paiement → ✅ Valider paiement"
echo "   4) Vérifier que les 3 emails arrivent bien"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
