-- Migration 0009: Table blacklist
-- Date: 2025-12-28
-- Description: Gestion des emails/téléphones indésirables

CREATE TABLE IF NOT EXISTS blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT,
  tel TEXT,
  raison TEXT,
  blacklisted_by INTEGER, -- ID du super_admin qui a blacklisté
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (blacklisted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Au moins un des deux doit être renseigné
CREATE INDEX IF NOT EXISTS idx_blacklist_email ON blacklist(email);
CREATE INDEX IF NOT EXISTS idx_blacklist_tel ON blacklist(tel);
