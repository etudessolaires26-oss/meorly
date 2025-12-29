#!/bin/bash
echo "🔍 DEBUG /mon-parcours/22"
echo ""

echo "1️⃣ Test de l'API directement..."
RESPONSE=$(curl -s https://meorly.pages.dev/mon-parcours/22)

if echo "$RESPONSE" | grep -q "Erreur lors du chargement"; then
  echo "❌ Erreur confirmée dans la page"
  echo ""
  echo "Cause probable : Les tables petek_templates, psalms ou angels sont vides"
  echo ""
  echo "📊 Solutions possibles :"
  echo "   A) Ajouter des fallbacks si les données manquent"
  echo "   B) Importer les seeds (migrations 0003, 0005, 0006)"
  echo "   C) Afficher un message plus clair à l'utilisateur"
else
  echo "✅ Page chargée correctement"
fi

echo ""
echo "2️⃣ Vérification des données attribuées..."
echo "   Cherchons l'inscription #22 et ses données..."

# Vérifier via l'API publique
curl -s https://meorly.pages.dev/api/inscriptions | jq '.[] | select(.id == 22)' 2>/dev/null
