-- =============================================
-- SEED: 30 Psaumes Essentiels
-- Sélection représentative des 150 Psaumes
-- =============================================

-- FONDATION & CONFIANCE (5 psaumes)
INSERT INTO psalms (number, title_fr, title_he, theme, tags, duration_min, level, guide_comment) VALUES
(1, 'Heureux l''homme qui ne suit pas...', 'אַ֭שְׁרֵי הָאִ֣ישׁ', 'fondation', '["fondation", "voie_juste", "choix", "integrite"]', 3, 'debutant', 'Psaume fondateur pour installer une direction claire et juste.'),
(23, 'L''Éternel est mon berger', 'יְהוָ֥ה רֹ֝עִ֗י', 'confiance', '["confiance", "protection", "serenite", "guidance"]', 5, 'debutant', 'Le plus connu, pour cultiver la confiance et la paix intérieure.'),
(91, 'Celui qui demeure sous l''abri du Très-Haut', 'יֹשֵׁ֗ב בְּסֵ֣תֶר עֶלְיֹון', 'protection', '["protection", "refuge", "securite", "ange_gardien"]', 7, 'intermediaire', 'Puissant psaume de protection, mentionne explicitement les anges.'),
(27, 'L''Éternel est ma lumière et mon salut', 'יְהוָ֤ה ׀ אֹ֭ורִי', 'courage', '["courage", "confiance", "lumiere", "force"]', 5, 'debutant', 'Pour trouver le courage face aux défis et à l''adversité.'),
(121, 'Je lève mes yeux vers les montagnes', 'אֶשָּׂ֣א עֵ֭ינַי', 'confiance', '["confiance", "protection", "voyage", "vigilance"]', 3, 'debutant', 'Court et puissant, idéal pour les voyages et la protection.'),

-- ÉPREUVES & RÉSILIENCE (5 psaumes)
(13, 'Jusques à quand, Éternel', 'עַד־אָ֥נָה יְהוָה', 'epreuve', '["epreuve", "patience", "foi", "attente"]', 3, 'debutant', 'Pour les moments d''attente difficile et de questionnement.'),
(22, 'Mon Dieu, mon Dieu, pourquoi m''as-tu abandonné', 'אֵלִ֣י אֵ֭לִי', 'souffrance', '["souffrance", "abandon", "delivrance", "resilience"]', 7, 'avance', 'Psaume profond pour les moments de grande souffrance.'),
(42, 'Comme une biche soupire après des courants d''eau', 'כְּאַיָּ֗ל תַּעֲרֹ֥ג', 'desir', '["desir", "soif", "quete", "manque"]', 5, 'intermediaire', 'Pour exprimer une soif spirituelle et un désir profond.'),
(130, 'Des profondeurs je crie vers toi', 'מִמַּעֲמַקִּ֖ים', 'detresse', '["detresse", "cri", "esperance", "attente"]', 3, 'intermediaire', 'Court psaume de supplication depuis les profondeurs.'),
(77, 'Ma voix s''élève vers Dieu', 'קֹולִ֤י', 'angoisse', '["angoisse", "nuit", "souvenir", "consolation"]', 5, 'intermediaire', 'Pour les nuits d''angoisse et de questionnement.'),

-- GRATITUDE & JOIE (4 psaumes)
(100, 'Poussez des cris de joie', 'הָרִ֥יעוּ', 'gratitude', '["gratitude", "joie", "louange", "reconnaissance"]', 2, 'debutant', 'Court psaume de joie et reconnaissance, idéal le matin.'),
(136, 'Louez l''Éternel, car il est bon', 'הֹ֘וד֤וּ', 'gratitude', '["gratitude", "bonte", "fidelite", "louange"]', 7, 'debutant', 'Psaume structuré avec refrain "Car sa bonté dure à toujours".'),
(145, 'Je t''exalterai, mon Dieu', 'אֲרֹומִמְךָ֣', 'louange', '["louange", "grandeur", "bonte", "provision"]', 5, 'debutant', 'Alphabétique, célèbre la grandeur et la bonté divine.'),
(103, 'Mon âme, bénis l''Éternel', 'בָּרֲכִ֥י נַפְשִׁי', 'benediction', '["benediction", "pardon", "guerison", "misericorde"]', 7, 'intermediaire', 'Pour célébrer les bienfaits et la miséricorde.'),

-- PAIX & SÉRÉNITÉ (4 psaumes)
(4, 'Quand je crie, réponds-moi', 'בְּקָרְאִ֡י', 'paix', '["paix", "reponse", "sommeil", "serenite"]', 2, 'debutant', 'Court psaume pour trouver la paix et le sommeil.'),
(131, 'Éternel, mon cœur n''est pas orgueilleux', 'יְהוָה֙', 'humilite', '["humilite", "simplicite", "paix", "confiance"]', 2, 'debutant', 'Très court, pour cultiver humilité et paix intérieure.'),
(46, 'Dieu est pour nous un refuge et un appui', 'אֱלֹהִ֣ים', 'refuge', '["refuge", "force", "paix", "presence"]', 5, 'intermediaire', 'Pour trouver la paix même dans le chaos.'),
(62, 'Oui, c''est en Dieu que mon âme se confie', 'אַ֤ךְ אֶל־אֱלֹהִ֨ים', 'confiance', '["confiance", "silence", "attente", "force"]', 3, 'intermediaire', 'Pour cultiver le silence intérieur et la confiance.'),

-- SANTÉ & RÉCUPÉRATION (3 psaumes)
(6, 'Éternel, ne me punis pas dans ta colère', 'יְהוָ֗ה אַל־בְּאַפְּךָ֥', 'guerison', '["guerison", "maladie", "fatigue", "delivrance"]', 3, 'intermediaire', 'Psaume pour accompagner la maladie et demander la guérison.'),
(30, 'Je t''exalte car tu m''as relevé', 'אֲרֹומִמְךָ֣', 'guerison', '["guerison", "delivrance", "gratitude", "vie"]', 5, 'intermediaire', 'Action de grâce après une guérison ou délivrance.'),
(41, 'Heureux celui qui s''intéresse au pauvre', 'אַ֭שְׁרֵי מַשְׂכִּ֣יל', 'compassion', '["compassion", "maladie", "protection", "relevement"]', 5, 'intermediaire', 'Pour accompagner la maladie avec compassion.'),

-- CLARTÉ & DÉCISION (3 psaumes)
(25, 'À toi, Éternel, j''élève mon âme', 'אֵלֶ֥יךָ יְ֝הוָ֗ה', 'direction', '["direction", "enseignement", "voie", "guidance"]', 7, 'intermediaire', 'Psaume alphabétique pour demander la guidance.'),
(139, 'Éternel, tu me sondes et tu me connais', 'יְהוָ֥ה חֲקַרְתַּ֗נִי', 'introspection', '["introspection", "connaissance_de_soi", "presence", "mystere"]', 10, 'avance', 'Psaume profond sur la connaissance de soi et la présence divine.'),
(119, 'Heureux ceux dont la voie est intègre', 'אַשְׁרֵ֥י', 'sagesse', '["sagesse", "torah", "voie", "discipline"]', 30, 'avance', 'Le plus long psaume (176 versets), pour la sagesse et l''étude.'),

-- PROTECTION & JUSTICE (3 psaumes)
(3, 'Éternel, que mes ennemis sont nombreux', 'יְ֭הוָה מָה־רַבּ֣וּ', 'protection', '["protection", "adversite", "delivrance", "matin"]', 3, 'debutant', 'Psaume du matin pour la protection face aux adversités.'),
(35, 'Éternel, défends-moi contre mes adversaires', 'רִיבָה֣', 'justice', '["justice", "defense", "combat", "delivrance"]', 10, 'avance', 'Pour demander justice et protection face à l''injustice.'),
(37, 'Ne t''irrite pas à cause des méchants', 'אַל־תִּתְחַ֥ר', 'patience', '["patience", "justice", "providence", "sagesse"]', 10, 'intermediaire', 'Psaume alphabétique sur la patience et la justice divine.'),

-- TRANSITION & RENOUVEAU (3 psaumes)
(40, 'J''ai placé mon espérance en l''Éternel', 'קַוֹּ֤ה קִוִּ֨יתִי', 'espérance', '["esperance", "delivrance", "chant_nouveau", "temoignage"]', 7, 'intermediaire', 'Pour les transitions : attente, délivrance, chant nouveau.'),
(126, 'Quand l''Éternel ramena les captifs', 'בְּשׁ֣וּב', 'retour', '["retour", "joie", "moisson", "larmes"]', 3, 'debutant', 'Court psaume des retours et des nouveaux commencements.'),
(84, 'Que tes demeures sont aimables', 'מַה־יְּדִידֹ֥ות', 'nostalgie', '["nostalgie", "desir", "presence", "joie"]', 5, 'intermediaire', 'Pour cultiver le désir spirituel et la joie de la présence.');
