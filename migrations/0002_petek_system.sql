-- =============================================
-- MIGRATION 002: Système Petek, Psaumes et Anges
-- =============================================

-- Table: petek_templates (Modèles de Peteks)
CREATE TABLE IF NOT EXISTS petek_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  theme TEXT NOT NULL,
  theme_label TEXT NOT NULL,
  
  -- Tags pour recommandation
  use_case_tags TEXT, -- JSON array en TEXT
  
  -- Intention (FR + Hébreu + Translitération)
  intent_fr TEXT NOT NULL,
  intent_he TEXT,
  intent_translit TEXT,
  
  -- Lecture/Formule (FR + Hébreu + Translitération)
  reading_fr TEXT NOT NULL,
  reading_he TEXT,
  reading_translit TEXT,
  
  -- Pratique recommandée
  practice TEXT, -- JSON en TEXT
  
  -- Commentaire du guide
  guide_comment_fr TEXT,
  
  -- Métadonnées
  duration_recommended INTEGER DEFAULT 3,
  cycle_days INTEGER DEFAULT 7,
  keywords TEXT, -- JSON array en TEXT
  
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index sur petek_templates
CREATE INDEX IF NOT EXISTS idx_petek_theme ON petek_templates(theme);
CREATE INDEX IF NOT EXISTS idx_petek_code ON petek_templates(code);
CREATE INDEX IF NOT EXISTS idx_petek_active ON petek_templates(is_active);

-- Table: psalms (Les 150 Psaumes)
CREATE TABLE IF NOT EXISTS psalms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number INTEGER UNIQUE NOT NULL,
  title_fr TEXT NOT NULL,
  title_he TEXT,
  
  -- Contenu du psaume
  text_fr TEXT,
  text_he TEXT,
  text_translit TEXT,
  
  -- Métadonnées
  theme TEXT,
  tags TEXT, -- JSON array en TEXT
  duration_min INTEGER DEFAULT 5,
  level TEXT DEFAULT 'debutant' CHECK (level IN ('debutant', 'intermediaire', 'avance')),
  
  -- Commentaire
  guide_comment TEXT,
  
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index sur psalms
CREATE INDEX IF NOT EXISTS idx_psalm_number ON psalms(number);
CREATE INDEX IF NOT EXISTS idx_psalm_theme ON psalms(theme);
CREATE INDEX IF NOT EXISTS idx_psalm_active ON psalms(is_active);

-- Table: psalm_rules (Règles d'attribution des psaumes)
CREATE TABLE IF NOT EXISTS psalm_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  psalm_id INTEGER NOT NULL REFERENCES psalms(id) ON DELETE CASCADE,
  condition_tags TEXT NOT NULL, -- JSON array: tags qui déclenchent cette règle
  score INTEGER DEFAULT 10, -- Score de pertinence
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index sur psalm_rules
CREATE INDEX IF NOT EXISTS idx_psalm_rules_psalm ON psalm_rules(psalm_id);

-- Table: angels (Les 24 Anges)
CREATE TABLE IF NOT EXISTS angels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name_fr TEXT NOT NULL,
  name_he TEXT,
  rank_order INTEGER UNIQUE,
  
  -- Description
  description_fr TEXT,
  tradition_source TEXT DEFAULT 'tradition',
  level TEXT DEFAULT 'debutant' CHECK (level IN ('debutant', 'avance')),
  
  -- Tags pour attribution
  tags TEXT NOT NULL, -- JSON array en TEXT
  
  -- Détails supplémentaires
  qualities TEXT, -- JSON array en TEXT
  invocation_context TEXT,
  
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index sur angels
CREATE INDEX IF NOT EXISTS idx_angel_slug ON angels(slug);
CREATE INDEX IF NOT EXISTS idx_angel_rank ON angels(rank_order);
CREATE INDEX IF NOT EXISTS idx_angel_level ON angels(level);
CREATE INDEX IF NOT EXISTS idx_angel_active ON angels(is_active);

-- Table: angel_rules (Règles d'attribution des anges)
CREATE TABLE IF NOT EXISTS angel_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  angel_id INTEGER NOT NULL REFERENCES angels(id) ON DELETE CASCADE,
  condition_tags TEXT NOT NULL, -- JSON array: tags requis
  score INTEGER DEFAULT 10,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index sur angel_rules
CREATE INDEX IF NOT EXISTS idx_angel_rules_angel ON angel_rules(angel_id);
CREATE INDEX IF NOT EXISTS idx_angel_rules_priority ON angel_rules(priority);

-- Table: user_peteks (Attribution des Peteks aux utilisateurs)
CREATE TABLE IF NOT EXISTS user_peteks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inscription_id INTEGER NOT NULL REFERENCES inscriptions(id) ON DELETE CASCADE,
  petek_template_id INTEGER NOT NULL REFERENCES petek_templates(id),
  
  -- Statut et dates
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'renewed', 'archived')),
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  
  -- Cycle
  cycle_number INTEGER DEFAULT 1,
  cycle_days_remaining INTEGER,
  
  -- Notes du guide
  guide_notes TEXT,
  
  -- Pratique utilisateur
  last_practiced_at DATETIME,
  practice_streak INTEGER DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index sur user_peteks
CREATE INDEX IF NOT EXISTS idx_user_peteks_inscription ON user_peteks(inscription_id);
CREATE INDEX IF NOT EXISTS idx_user_peteks_template ON user_peteks(petek_template_id);
CREATE INDEX IF NOT EXISTS idx_user_peteks_status ON user_peteks(status);

-- Table: user_psalms (Attribution des Psaumes aux utilisateurs)
CREATE TABLE IF NOT EXISTS user_psalms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inscription_id INTEGER NOT NULL REFERENCES inscriptions(id) ON DELETE CASCADE,
  psalm_id INTEGER NOT NULL REFERENCES psalms(id),
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Pratique
  last_practiced_at DATETIME,
  practice_count INTEGER DEFAULT 0,
  
  guide_notes TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index sur user_psalms
CREATE INDEX IF NOT EXISTS idx_user_psalms_inscription ON user_psalms(inscription_id);
CREATE INDEX IF NOT EXISTS idx_user_psalms_psalm ON user_psalms(psalm_id);
CREATE INDEX IF NOT EXISTS idx_user_psalms_status ON user_psalms(status);

-- Table: user_angels (Attribution des Anges aux utilisateurs)
CREATE TABLE IF NOT EXISTS user_angels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inscription_id INTEGER NOT NULL REFERENCES inscriptions(id) ON DELETE CASCADE,
  angel_id INTEGER NOT NULL REFERENCES angels(id),
  
  rank_assigned INTEGER, -- 1=protecteur principal, 2=secondaire
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  guide_notes TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index sur user_angels
CREATE INDEX IF NOT EXISTS idx_user_angels_inscription ON user_angels(inscription_id);
CREATE INDEX IF NOT EXISTS idx_user_angels_angel ON user_angels(angel_id);
CREATE INDEX IF NOT EXISTS idx_user_angels_rank ON user_angels(rank_assigned);

-- Table: manifestes (Manifeste spirituel de l'utilisateur)
CREATE TABLE IF NOT EXISTS manifestes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inscription_id INTEGER NOT NULL REFERENCES inscriptions(id) ON DELETE CASCADE,
  
  theme TEXT NOT NULL,
  theme_autre TEXT,
  reponses TEXT, -- JSON array en TEXT
  content TEXT,
  
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'analyzed')),
  analysis TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index sur manifestes
CREATE INDEX IF NOT EXISTS idx_manifestes_inscription ON manifestes(inscription_id);
CREATE INDEX IF NOT EXISTS idx_manifestes_status ON manifestes(status);
