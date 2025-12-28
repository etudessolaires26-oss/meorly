-- Migration 0007: Système d'authentification multi-niveaux
-- Date: 2025-12-28
-- Description: Tables users, user_profiles, rendez_vous, payments pour le système complet

-- Table users: Authentification et rôles
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'guide', 'super_admin')) DEFAULT 'client',
  status TEXT NOT NULL CHECK (status IN ('pending_payment', 'active', 'suspended', 'inactive')) DEFAULT 'pending_payment',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

-- Table user_profiles: Informations détaillées utilisateurs
CREATE TABLE IF NOT EXISTS user_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  tel TEXT,
  
  -- Formule choisie
  formule TEXT CHECK (formule IN ('essentiel', 'psaumes', 'integral')),
  formule_prix REAL,
  
  -- Statut paiement
  payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')) DEFAULT 'pending',
  payment_date DATETIME,
  payment_amount REAL,
  payment_method TEXT, -- 'stripe', 'viva', 'iban', 'manual'
  payment_reference TEXT, -- Référence de transaction
  
  -- Info guide assigné
  guide_id INTEGER,
  
  -- Dates importantes
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (guide_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Table rendez_vous: Gestion des rendez-vous
CREATE TABLE IF NOT EXISTS rendez_vous (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  guide_id INTEGER,
  
  -- Date et durée
  date_rdv DATETIME NOT NULL,
  duree_minutes INTEGER DEFAULT 45,
  
  -- Statut
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')) DEFAULT 'scheduled',
  
  -- Type de rendez-vous
  type TEXT CHECK (type IN ('initial', 'followup', 'urgent')),
  
  -- Notes
  notes TEXT,
  guide_notes TEXT, -- Notes privées du guide
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (guide_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Table payments: Historique des paiements
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  
  -- Montant et devise
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'EUR',
  
  -- Formule achetée
  formule TEXT NOT NULL CHECK (formule IN ('essentiel', 'psaumes', 'integral')),
  
  -- Statut paiement
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
  
  -- Méthode et référence
  payment_method TEXT, -- 'stripe', 'viva', 'iban', 'manual'
  payment_reference TEXT,
  transaction_id TEXT,
  
  -- Dates
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Modifier la table inscriptions pour lier avec users
ALTER TABLE inscriptions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_guide ON user_profiles(guide_id);
CREATE INDEX IF NOT EXISTS idx_rendez_vous_client ON rendez_vous(client_id);
CREATE INDEX IF NOT EXISTS idx_rendez_vous_guide ON rendez_vous(guide_id);
CREATE INDEX IF NOT EXISTS idx_rendez_vous_date ON rendez_vous(date_rdv);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
