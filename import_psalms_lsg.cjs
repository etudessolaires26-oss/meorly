#!/usr/bin/env node

/**
 * Script pour importer les 150 Psaumes Louis Segond 1910 depuis GetBible API
 * Usage: node import_psalms_lsg.js
 */

const fs = require('fs');
const https = require('https');

const BASE_URL = 'https://api.getbible.net/v2/ls1910/19'; // Livre 19 = Psaumes
const OUTPUT_FILE = './migrations/0006_seed_psalms_lsg_full.sql';

// Mapping des psaumes que nous avons déjà avec leurs métadonnées
const EXISTING_PSALMS = {
  1: { theme: 'fondation', tags: '["fondation", "voie_juste", "choix", "integrite"]', level: 'debutant', duration: 3 },
  3: { theme: 'protection', tags: '["protection", "adversite", "delivrance", "matin"]', level: 'debutant', duration: 3 },
  4: { theme: 'paix', tags: '["paix", "reponse", "sommeil", "serenite"]', level: 'debutant', duration: 2 },
  6: { theme: 'guerison', tags: '["guerison", "maladie", "fatigue", "delivrance"]', level: 'intermediaire', duration: 3 },
  13: { theme: 'epreuve', tags: '["epreuve", "patience", "foi", "attente"]', level: 'debutant', duration: 3 },
  22: { theme: 'souffrance', tags: '["souffrance", "abandon", "delivrance", "resilience"]', level: 'avance', duration: 7 },
  23: { theme: 'confiance', tags: '["confiance", "protection", "serenite", "guidance"]', level: 'debutant', duration: 5 },
  25: { theme: 'direction', tags: '["direction", "enseignement", "voie", "guidance"]', level: 'intermediaire', duration: 7 },
  27: { theme: 'courage', tags: '["courage", "confiance", "lumiere", "force"]', level: 'debutant', duration: 5 },
  30: { theme: 'guerison', tags: '["guerison", "delivrance", "gratitude", "vie"]', level: 'intermediaire', duration: 5 },
  35: { theme: 'justice', tags: '["justice", "defense", "combat", "delivrance"]', level: 'avance', duration: 10 },
  37: { theme: 'patience', tags: '["patience", "justice", "providence", "sagesse"]', level: 'intermediaire', duration: 10 },
  40: { theme: 'esperance', tags: '["esperance", "delivrance", "chant_nouveau", "temoignage"]', level: 'intermediaire', duration: 7 },
  41: { theme: 'compassion', tags: '["compassion", "maladie", "protection", "relevement"]', level: 'intermediaire', duration: 5 },
  42: { theme: 'desir', tags: '["desir", "soif", "quete", "manque"]', level: 'intermediaire', duration: 5 },
  46: { theme: 'refuge', tags: '["refuge", "force", "paix", "presence"]', level: 'intermediaire', duration: 5 },
  62: { theme: 'confiance', tags: '["confiance", "silence", "attente", "force"]', level: 'intermediaire', duration: 3 },
  77: { theme: 'angoisse', tags: '["angoisse", "nuit", "souvenir", "consolation"]', level: 'intermediaire', duration: 5 },
  84: { theme: 'nostalgie', tags: '["nostalgie", "desir", "presence", "joie"]', level: 'intermediaire', duration: 5 },
  91: { theme: 'protection', tags: '["protection", "refuge", "securite", "ange_gardien"]', level: 'intermediaire', duration: 7 },
  100: { theme: 'gratitude', tags: '["gratitude", "joie", "louange", "reconnaissance"]', level: 'debutant', duration: 2 },
  103: { theme: 'benediction', tags: '["benediction", "pardon", "guerison", "misericorde"]', level: 'intermediaire', duration: 7 },
  119: { theme: 'sagesse', tags: '["sagesse", "torah", "voie", "discipline"]', level: 'avance', duration: 30 },
  121: { theme: 'confiance', tags: '["confiance", "protection", "voyage", "vigilance"]', level: 'debutant', duration: 3 },
  126: { theme: 'retour', tags: '["retour", "joie", "moisson", "larmes"]', level: 'debutant', duration: 3 },
  130: { theme: 'detresse', tags: '["detresse", "cri", "esperance", "attente"]', level: 'intermediaire', duration: 3 },
  131: { theme: 'humilite', tags: '["humilite", "simplicite", "paix", "confiance"]', level: 'debutant', duration: 2 },
  136: { theme: 'gratitude', tags: '["gratitude", "bonte", "fidelite", "louange"]', level: 'debutant', duration: 7 },
  139: { theme: 'introspection', tags: '["introspection", "connaissance_de_soi", "presence", "mystere"]', level: 'avance', duration: 10 },
  145: { theme: 'louange', tags: '["louange", "grandeur", "bonte", "provision"]', level: 'debutant', duration: 5 }
};

function fetchPsalm(psalmNumber) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}/${psalmNumber}.json`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function generateSQL(psalmsData) {
  let sql = `-- =============================================
-- Migration: Import complet des 150 Psaumes Louis Segond 1910
-- Source: GetBible API (https://getbible.net)
-- Date: ${new Date().toISOString().split('T')[0]}
-- =============================================

-- Ajouter la colonne full_text_fr si elle n'existe pas
ALTER TABLE psalms ADD COLUMN full_text_fr TEXT;

`;

  psalmsData.forEach(psalm => {
    if (!psalm || !psalm.verses) return;

    const psalmNumber = parseInt(psalm.name.replace('Psaumes ', ''));
    const metadata = EXISTING_PSALMS[psalmNumber] || {
      theme: 'general',
      tags: '["meditation", "priere"]',
      level: 'intermediaire',
      duration: 5
    };

    // Combiner tous les versets en un seul texte
    const verses = Object.values(psalm.verses);
    const fullText = verses.map(v => v.text).join('');
    
    // Échapper les apostrophes pour SQL
    const escapedText = fullText.replace(/'/g, "''");
    const escapedTitle = verses[0]?.text?.substring(0, 100).replace(/'/g, "''") || `Psaume ${psalmNumber}`;

    sql += `-- Psaume ${psalmNumber}
UPDATE psalms 
SET full_text_fr = '${escapedText}'
WHERE number = ${psalmNumber};

`;

    // Si le psaume n'existe pas encore, l'insérer
    sql += `INSERT OR IGNORE INTO psalms (number, title_fr, full_text_fr, theme, tags, duration_min, level, is_active)
VALUES (
  ${psalmNumber},
  '${escapedTitle}',
  '${escapedText}',
  '${metadata.theme}',
  '${metadata.tags}',
  ${metadata.duration},
  '${metadata.level}',
  1
);

`;
  });

  return sql;
}

async function main() {
  console.log('🔄 Téléchargement des 150 Psaumes Louis Segond 1910...\n');
  
  const psalmsData = [];
  
  for (let i = 1; i <= 150; i++) {
    try {
      process.stdout.write(`\r[${i}/150] Psaume ${i}...`);
      const psalm = await fetchPsalm(i);
      psalmsData.push(psalm);
      
      // Petite pause pour ne pas surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`\n❌ Erreur Psaume ${i}:`, error.message);
    }
  }

  console.log('\n\n✅ Téléchargement terminé !');
  console.log(`📊 ${psalmsData.length} Psaumes récupérés\n`);

  console.log('📝 Génération du fichier SQL...');
  const sql = generateSQL(psalmsData);

  fs.writeFileSync(OUTPUT_FILE, sql, 'utf8');
  console.log(`✅ Fichier créé: ${OUTPUT_FILE}`);
  console.log(`📏 Taille: ${(sql.length / 1024).toFixed(2)} KB\n`);

  console.log('🎉 Import terminé ! Pour appliquer la migration:');
  console.log(`   cd /home/user/webapp && npx wrangler d1 migrations apply webapp-production --local\n`);
}

main().catch(console.error);
