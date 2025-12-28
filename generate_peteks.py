#!/usr/bin/env python3
"""
Générateur de 300 Peteks pour Académie de la Lumière
Adapté pour D1 (SQLite)
"""

import json
import random

# Définir les thèmes
themes = [
    ('paix', 'Paix intérieure'),
    ('amour', 'Amour & Relations'),
    ('reussite', 'Réussite & Abondance'),
    ('sante', 'Santé & Équilibre'),
    ('protection', 'Protection & Stabilité'),
    ('sagesse', 'Sagesse & Orientation')
]

# Sous-tags par thème
subtags = {
    'paix': ['stress', 'anxiete', 'apaisement', 'sommeil', 'clarte', 'culpabilite', 'tension', 'panique', 'fatigue_mentale', 'emotions'],
    'amour': ['ouverture', 'confiance_relationnelle', 'communication', 'reconciliation', 'rupture', 'famille', 'limites', 'pardon', 'attachement', 'respect'],
    'reussite': ['discipline', 'focus', 'opportunites', 'decision', 'leadership', 'finances', 'travail', 'audace', 'organisation', 'projet'],
    'sante': ['rythme', 'energie', 'recuperation', 'equilibre', 'apaisement_corps', 'motivation', 'hygiene', 'douceur', 'endurance', 'emotions_corps'],
    'protection': ['ancrage', 'limites_protection', 'peur', 'stabilite', 'foyer', 'serenite', 'courage', 'integrite', 'confiance_soi', 'calme_profond'],
    'sagesse': ['discernement', 'patience', 'humilite', 'gratitude', 'sens', 'coherence', 'lucidite', 'etude', 'perseverance', 'orientation']
}

# Fragments FR par thème
fragments_fr = {
    'paix': {
        'A': [
            "Je choisis la paix comme point de départ.",
            "Je reviens au calme, sans lutte inutile.",
            "Je relâche la pression et je respire.",
            "Je laisse mon esprit se clarifier.",
            "Je me recentre et je retrouve mon axe."
        ],
        'B': [
            "Je laisse passer ce qui me traverse.",
            "Je ne nourris plus l'agitation.",
            "Je reviens à l'essentiel, simplement.",
            "Je pose des limites à l'inquiétude.",
            "Je transforme la tension en présence."
        ],
        'C': [
            "La paix s'installe en moi, progressivement.",
            "Je retrouve un rythme intérieur stable.",
            "Je marche avec douceur et lucidité.",
            "Je choisis la clarté plutôt que la peur.",
            "Je termine la journée en paix."
        ]
    },
    'amour': {
        'A': [
            "J'ouvre mon cœur à une relation juste.",
            "Je choisis l'harmonie et la dignité.",
            "Je parle avec vérité et respect.",
            "Je me respecte et je respecte l'autre.",
            "Je fais de la place au lien apaisé."
        ],
        'B': [
            "Je coupe avec les schémas qui me blessent.",
            "Je restaure la confiance par des actes simples.",
            "Je demande clairement ce dont j'ai besoin.",
            "Je pardonne sans me renier.",
            "Je pose une limite là où c'est nécessaire."
        ],
        'C': [
            "Je laisse venir ce qui est bon pour moi.",
            "Je choisis une relation stable et saine.",
            "Je construis sur le long terme.",
            "Je me libère des attachements inutiles.",
            "Je retrouve une paix relationnelle."
        ]
    },
    'reussite': {
        'A': [
            "Je progresse avec constance et discipline.",
            "Je me mets en mouvement, sans excuse.",
            "Je construis une réussite honnête.",
            "Je clarifie mes priorités et j'agis.",
            "Je choisis un cap et je le tiens."
        ],
        'B': [
            "Je valorise mon travail et mon temps.",
            "Je prends des décisions avec lucidité.",
            "Je saisis les opportunités avec prudence.",
            "Je m'organise et je simplifie.",
            "Je fais ce qui doit être fait, maintenant."
        ],
        'C': [
            "Je récolte les fruits de mes efforts.",
            "Je grandis, pas à pas, durablement.",
            "Je stabilise mes finances et mes projets.",
            "Je gagne en leadership et en clarté.",
            "Je crée de la valeur utile et juste."
        ]
    },
    'sante': {
        'A': [
            "Je respecte mon corps et mon rythme.",
            "Je restaure mon équilibre, sans brutalité.",
            "Je choisis la récupération et la stabilité.",
            "Je prends soin de mon énergie vitale.",
            "Je me traite avec douceur et sérieux."
        ],
        'B': [
            "Je reviens à des habitudes simples.",
            "Je soutiens mon sommeil et mon repos.",
            "Je laisse mon corps se rééquilibrer.",
            "Je respire et je relâche les tensions.",
            "Je reviens à une hygiène régulière."
        ],
        'C': [
            "Je progresse dans la durée, calmement.",
            "Je fais ma part avec patience.",
            "Je stabilise mon énergie jour après jour.",
            "Je retrouve une force intérieure tranquille.",
            "Je m'ancre dans un mieux-être réel."
        ]
    },
    'protection': {
        'A': [
            "Je suis à ma place et je reste stable.",
            "Je protège mon espace intérieur.",
            "Je ferme la porte à ce qui me nuit.",
            "Je renforce mes limites avec calme.",
            "Je marche avec courage et intégrité."
        ],
        'B': [
            "Je choisis la sécurité et la prudence.",
            "Je ne me laisse pas emporter par la peur.",
            "Je garde mon axe même sous pression.",
            "Je clarifie ce que j'accepte et refuse.",
            "Je stabilise mon foyer et mon esprit."
        ],
        'C': [
            "Je me sens protégé dans mes décisions.",
            "Je reste serein et vigilant.",
            "Je traverse l'épreuve sans me perdre.",
            "Je choisis la voie droite, sans excès.",
            "Je reviens à un calme solide."
        ]
    },
    'sagesse': {
        'A': [
            "Je cherche le sens avec lucidité.",
            "Je développe mon discernement.",
            "Je baisse l'orgueil et j'apprends.",
            "Je choisis la cohérence intérieure.",
            "Je m'ouvre à une guidance sobre."
        ],
        'B': [
            "Je distingue l'essentiel du superflu.",
            "Je prends du recul avant d'agir.",
            "Je corrige ma direction sans me juger.",
            "Je cultive gratitude et patience.",
            "Je continue même lentement."
        ],
        'C': [
            "Je choisis selon mes valeurs.",
            "Je marche avec responsabilité et clarté.",
            "Je grandis par l'apprentissage et l'expérience.",
            "Je reviens à une voie simple et droite.",
            "Je stabilise ma direction de vie."
        ]
    }
}

# Lectures courtes FR
lectures_fr = [
    "Je respire, je me recentre, et j'avance.",
    "Je choisis le calme et la justesse.",
    "Je fais ma part aujourd'hui, simplement.",
    "Je reviens à l'essentiel, maintenant.",
    "Je marche avec clarté et douceur."
]

# Générer le SQL
sql_lines = []
sql_lines.append("-- =============================================")
sql_lines.append("-- SEED: 300 Peteks Complets (Génération Automatique)")
sql_lines.append("-- Académie de la Lumière")
sql_lines.append("-- =============================================\n")

petek_num = 1
for theme_code, theme_label in themes:
    for variant in range(1, 51):  # 50 variants par thème
        # Choisir des fragments aléatoires mais reproductibles
        random.seed(petek_num)
        
        frag_a = random.choice(fragments_fr[theme_code]['A'])
        frag_b = random.choice(fragments_fr[theme_code]['B'])
        frag_c = random.choice(fragments_fr[theme_code]['C'])
        lecture = random.choice(lectures_fr)
        
        # Intention = combiner les 3 fragments
        intention = f"{frag_a} {frag_b} {frag_c}"
        
        # Tags (2-3 tags aléatoires pour ce petek)
        num_tags = random.randint(2, 3)
        selected_tags = random.sample(subtags[theme_code], num_tags)
        tags_json = json.dumps(selected_tags)
        
        # Code du petek
        code = f"PTEK-{theme_code.upper()}-{petek_num:03d}"
        
        # Durée et cycle
        duration = random.choice([3, 5, 7])
        cycle = random.choice([7, 14, 21])
        
        # Commentaire du guide
        guide_comment = f"Petek {variant}/50 pour {theme_label}. Pratique quotidienne recommandée."
        
        # Construire l'INSERT
        sql_lines.append(f"INSERT INTO petek_templates (code, theme, theme_label, use_case_tags, intent_fr, reading_fr, guide_comment_fr, duration_recommended, cycle_days) VALUES")
        sql_lines.append(f"('{code}', '{theme_code}', '{theme_label}', '{tags_json}',")
        # Échapper les apostrophes
        intention_escaped = intention.replace("'", "''")
        lecture_escaped = lecture.replace("'", "''")
        guide_escaped = guide_comment.replace("'", "''")
        sql_lines.append(f" '{intention_escaped}',")
        sql_lines.append(f" '{lecture_escaped}',")
        sql_lines.append(f" '{guide_escaped}',")
        sql_lines.append(f" {duration}, {cycle});")
        sql_lines.append("")
        
        petek_num += 1

# Écrire dans un fichier
output_file = "/home/user/webapp/migrations/0003_seed_peteks_300.sql"
with open(output_file, 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))

print(f"✅ Généré {petek_num - 1} Peteks dans {output_file}")
print(f"📊 Répartition: {len(themes)} thèmes × 50 variants = {petek_num - 1} Peteks")
