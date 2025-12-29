-- Migration 0012: Système de suivi de progression client
-- Date: 2025-12-28
-- Description: Table user_progress + colonnes program_status

-- Table de progression des utilisateurs
CREATE TABLE IF NOT EXISTS user_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  inscription_id INTEGER NOT NULL,
  
  -- Progression du programme
  current_day INTEGER DEFAULT 0,           -- Jour actuel (0-21)
  days_completed INTEGER DEFAULT 0,        -- Nombre de jours validés
  total_days INTEGER DEFAULT 21,           -- Durée totale du programme
  
  -- Historique (JSON array des dates complétées)
  completion_history TEXT,                 -- JSON: ["2025-01-15", "2025-01-16", ...]
  
  -- Dates importantes
  started_at DATETIME,                     -- Date de début du programme
  last_activity DATETIME,                  -- Dernière activité
  completed_at DATETIME,                   -- Date de fin (21 jours)
  
  -- Statistiques
  current_streak INTEGER DEFAULT 0,        -- Série de jours consécutifs
  longest_streak INTEGER DEFAULT 0,        -- Plus longue série
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (inscription_id) REFERENCES inscriptions(id) ON DELETE CASCADE
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_inscription_id ON user_progress(inscription_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_last_activity ON user_progress(last_activity);

-- Ajouter colonnes à user_profiles pour le statut du programme
ALTER TABLE user_profiles ADD COLUMN program_status TEXT 
  CHECK (program_status IN ('active', 'completed', 'revoked', 'archived')) 
  DEFAULT 'active';

ALTER TABLE user_profiles ADD COLUMN program_started_at DATETIME;
ALTER TABLE user_profiles ADD COLUMN program_completed_at DATETIME;
ALTER TABLE user_profiles ADD COLUMN program_revoked_at DATETIME;
ALTER TABLE user_profiles ADD COLUMN program_revoked_reason TEXT;

-- Ajouter colonne pour le statut des users (actif/révoqué)
ALTER TABLE users ADD COLUMN account_status TEXT 
  CHECK (account_status IN ('active', 'revoked', 'archived')) 
  DEFAULT 'active';

-- Index
CREATE INDEX IF NOT EXISTS idx_user_profiles_program_status ON user_profiles(program_status);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
