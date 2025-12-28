-- =============================================
-- SEED: 24 Anges Complets
-- Basé sur le système d'Académie de la Lumière
-- =============================================

INSERT INTO angels (slug, name_fr, name_he, rank_order, description_fr, tradition_source, level, tags) VALUES
('metatron', 'Métatron', 'מטטרון', 1, 'Clarté, structure et alignement intérieur.', 'tradition', 'avance', '["clarte","structure","decision","protection"]'),
('michael', 'Michaël', 'מיכאל', 2, 'Protection, courage et tenue dans l''épreuve.', 'tradition', 'debutant', '["protection","courage","stabilite","route"]'),
('gabriel', 'Gabriel', 'גבריאל', 3, 'Annonce, transmission, communication et guidance.', 'tradition', 'debutant', '["communication","message","intuition","direction"]'),
('raphael', 'Raphaël', 'רפאל', 4, 'Apaisement, reconstruction, hygiène de vie et équilibre.', 'tradition', 'debutant', '["apaisement","equilibre","reprise","paix"]'),
('uriel', 'Uriel', 'אוריאל', 5, 'Lumière mentale, discernement et résolution.', 'tradition', 'debutant', '["discernement","clarte","etudes","focus"]'),
('zadkiel', 'Zadkiel', 'צדקיאל', 6, 'Pardon, réparation, sortie de rancune.', 'tradition', 'avance', '["reparation","pardon","relation","harmonie"]'),
('chamuel', 'Chamuel', 'קמואל', 7, 'Relations, harmonie, lien et pacification.', 'tradition', 'debutant', '["relation","harmonie","paix","cohesion"]'),
('haniel', 'Haniel', 'חניאל', 8, 'Équilibre émotionnel, grâce et douceur.', 'tradition', 'debutant', '["douceur","emotion","paix","stabilite"]'),
('jophiel', 'Jophiel', 'יופיאל', 9, 'Beauté, inspiration, créativité et goût juste.', 'tradition', 'debutant', '["inspiration","creation","esthetique","joie"]'),
('raziel', 'Raziel', 'רזיאל', 10, 'Intelligence symbolique, compréhension et profondeur.', 'tradition', 'avance', '["sagesse","comprehension","vision","mystique_sobre"]'),
('sandalphon', 'Sandalphon', 'סנדלפון', 11, 'Ancrage, constance, discipline et pratique.', 'tradition', 'debutant', '["routine","discipline","ancrage","perseverance"]'),
('azrael', 'Azraël', 'עזראל', 12, 'Traversée du deuil, mémoire et apaisement.', 'tradition', 'avance', '["deuil","traversee","apaisement","memoire"]'),
('selaphiel', 'Séla(ph)iel', 'סלאפיאל', 13, 'Intériorité, prière, recentrage.', 'tradition', 'debutant', '["interiorite","silence","paix","presence"]'),
('jeremiel', 'Jérémiel', 'ירמיאל', 14, 'Bilan de vie, choix, réorientation.', 'tradition', 'avance', '["bilan","reorientation","decision","sens"]'),
('raguel', 'Raguel', 'רעואל', 15, 'Justice relationnelle, médiation, cadre.', 'tradition', 'avance', '["conflit","cadre","justice","relation"]'),
('remiel', 'Rémiël', 'רעמיאל', 16, 'Espoir, relèvement, sortie de découragement.', 'tradition', 'debutant', '["espoir","reprise","elan","paix"]'),
('sariel', 'Sariel', 'שריאל', 17, 'Protection discrète, sobriété, prudence.', 'tradition', 'avance', '["protection","prudence","route","securite_pro"]'),
('anael', 'Anaël', 'אנאל', 18, 'Amour, réconciliation, tendresse.', 'tradition', 'debutant', '["amour","relation","reconciliation","douceur"]'),
('barachiel', 'Barachiel', 'ברכיאל', 19, 'Bénédiction, ouverture, opportunités.', 'tradition', 'debutant', '["abondance","reussite","opportunites","chance_sobre"]'),
('cassiel', 'Cassiel', 'קפציאל', 20, 'Patience, endurance, long terme.', 'tradition', 'avance', '["endurance","long_terme","stabilite","strategie"]'),
('vehuel', 'Véhuel', 'והואל', 21, 'Élévation morale, inspiration et noblesse d''âme.', 'tradition', 'avance', '["sagesse","inspiration","valeurs","paix"]'),
('nemamiah', 'Némamiah', 'נממיה', 22, 'Leadership, organisation, efficacité.', 'tradition', 'avance', '["leadership","organisation","execution","pro"]'),
('nanael', 'Nanaël', 'נאנאל', 23, 'Études, compréhension, mémoire et méthode.', 'tradition', 'debutant', '["etudes","focus","memoire","clarte"]'),
('yesalel', 'Yesalel', 'יסאלל', 24, 'Loyauté, réparation de lien, stabilité relationnelle.', 'tradition', 'avance', '["relation","reparation","cohesion","stabilite"]');

-- =============================================
-- RÈGLES D'ATTRIBUTION DES ANGES
-- =============================================

-- Pour PROTECTION
INSERT INTO angel_rules (angel_id, condition_tags, score, priority) 
SELECT id, '["protection","courage","route"]', 24, 'high' FROM angels WHERE slug = 'michael' UNION ALL
SELECT id, '["protection","prudence","securite_pro"]', 18, 'normal' FROM angels WHERE slug = 'sariel' UNION ALL
SELECT id, '["protection","paix","apaisement"]', 16, 'normal' FROM angels WHERE slug = 'raphael';

-- Pour PAIX INTÉRIEURE
INSERT INTO angel_rules (angel_id, condition_tags, score, priority)
SELECT id, '["paix","silence","interiorite"]', 24, 'high' FROM angels WHERE slug = 'selaphiel' UNION ALL
SELECT id, '["paix","apaisement","equilibre"]', 20, 'normal' FROM angels WHERE slug = 'raphael' UNION ALL
SELECT id, '["paix","clarte","discernement"]', 18, 'normal' FROM angels WHERE slug = 'uriel' UNION ALL
SELECT id, '["paix","douceur","emotion"]', 16, 'normal' FROM angels WHERE slug = 'haniel';

-- Pour RELATIONS / HARMONIE
INSERT INTO angel_rules (angel_id, condition_tags, score, priority)
SELECT id, '["relation","harmonie","cohesion"]', 24, 'high' FROM angels WHERE slug = 'chamuel' UNION ALL
SELECT id, '["relation","pardon","reparation"]', 22, 'high' FROM angels WHERE slug = 'zadkiel' UNION ALL
SELECT id, '["relation","conflit","justice"]', 20, 'normal' FROM angels WHERE slug = 'raguel' UNION ALL
SELECT id, '["relation","amour","reconciliation"]', 18, 'normal' FROM angels WHERE slug = 'anael';

-- Pour RÉUSSITE / ABONDANCE
INSERT INTO angel_rules (angel_id, condition_tags, score, priority)
SELECT id, '["reussite","abondance","opportunites"]', 24, 'high' FROM angels WHERE slug = 'barachiel' UNION ALL
SELECT id, '["reussite","leadership","organisation"]', 20, 'normal' FROM angels WHERE slug = 'nemamiah' UNION ALL
SELECT id, '["reussite","discipline","perseverance"]', 18, 'normal' FROM angels WHERE slug = 'sandalphon';

-- Pour CLARTÉ / DÉCISION
INSERT INTO angel_rules (angel_id, condition_tags, score, priority)
SELECT id, '["clarte","discernement","focus"]', 24, 'high' FROM angels WHERE slug = 'uriel' UNION ALL
SELECT id, '["clarte","structure","decision"]', 22, 'high' FROM angels WHERE slug = 'metatron' UNION ALL
SELECT id, '["clarte","direction","communication"]', 18, 'normal' FROM angels WHERE slug = 'gabriel';

-- Pour SANTÉ / ÉQUILIBRE
INSERT INTO angel_rules (angel_id, condition_tags, score, priority)
SELECT id, '["sante","apaisement","equilibre"]', 24, 'high' FROM angels WHERE slug = 'raphael' UNION ALL
SELECT id, '["sante","douceur","stabilite"]', 18, 'normal' FROM angels WHERE slug = 'haniel';

-- Pour TRANSITION / DEUIL
INSERT INTO angel_rules (angel_id, condition_tags, score, priority)
SELECT id, '["deuil","traversee","apaisement"]', 24, 'high' FROM angels WHERE slug = 'azrael' UNION ALL
SELECT id, '["transition","espoir","reprise"]', 20, 'normal' FROM angels WHERE slug = 'remiel' UNION ALL
SELECT id, '["transition","decision","sens"]', 18, 'normal' FROM angels WHERE slug = 'jeremiel';

-- Pour ÉTUDES / APPRENTISSAGE
INSERT INTO angel_rules (angel_id, condition_tags, score, priority)
SELECT id, '["etudes","memoire","focus"]', 24, 'high' FROM angels WHERE slug = 'nanael' UNION ALL
SELECT id, '["etudes","clarte","discernement"]', 20, 'normal' FROM angels WHERE slug = 'uriel';

-- Pour CRÉATIVITÉ / INSPIRATION
INSERT INTO angel_rules (angel_id, condition_tags, score, priority)
SELECT id, '["creation","inspiration","joie"]', 24, 'high' FROM angels WHERE slug = 'jophiel' UNION ALL
SELECT id, '["creation","inspiration","sagesse"]', 18, 'normal' FROM angels WHERE slug = 'vehuel';

-- Pour SAGESSE / PROFONDEUR
INSERT INTO angel_rules (angel_id, condition_tags, score, priority)
SELECT id, '["sagesse","comprehension","vision"]', 24, 'high' FROM angels WHERE slug = 'raziel' UNION ALL
SELECT id, '["sagesse","valeurs","inspiration"]', 18, 'normal' FROM angels WHERE slug = 'vehuel';
