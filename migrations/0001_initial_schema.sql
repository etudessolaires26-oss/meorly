-- Inscriptions table
CREATE TABLE IF NOT EXISTS inscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  tel TEXT,
  objectif TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending'
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inscriptions_email ON inscriptions(email);
CREATE INDEX IF NOT EXISTS idx_inscriptions_created_at ON inscriptions(created_at);
CREATE INDEX IF NOT EXISTS idx_inscriptions_status ON inscriptions(status);
