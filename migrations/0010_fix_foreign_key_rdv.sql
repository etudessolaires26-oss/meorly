-- Migration: Fix FOREIGN KEY rendez_vous.client_id
-- Problème: client_id pointait vers users.id, mais users n'existent qu'après paiement
-- Solution: Pointer vers inscriptions.id pour permettre les RDV avant création du compte

-- Désactiver temporairement les contraintes FK
PRAGMA foreign_keys = OFF;

-- Créer nouvelle table avec FK corrigée
CREATE TABLE rendez_vous_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES inscriptions(id) ON DELETE CASCADE,
  guide_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  date_rdv DATETIME NOT NULL,
  duree_minutes INTEGER DEFAULT 45,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  type TEXT,
  notes TEXT,
  guide_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copier les données existantes (si il y en a)
INSERT INTO rendez_vous_new 
SELECT * FROM rendez_vous;

-- Supprimer ancienne table
DROP TABLE rendez_vous;

-- Renommer nouvelle table
ALTER TABLE rendez_vous_new RENAME TO rendez_vous;

-- Créer les indexes
CREATE INDEX idx_rdv_client ON rendez_vous(client_id);
CREATE INDEX idx_rdv_guide ON rendez_vous(guide_id);
CREATE INDEX idx_rdv_date ON rendez_vous(date_rdv);
CREATE INDEX idx_rdv_status ON rendez_vous(status);

-- Réactiver les contraintes FK
PRAGMA foreign_keys = ON;
