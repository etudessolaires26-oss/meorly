-- Migration 0011: Système de messagerie Guide ↔ Client
-- Date: 2025-12-28
-- Description: Table messages pour communication en temps réel

-- Table des messages
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inscription_id INTEGER REFERENCES inscriptions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT 0,
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_inscription ON messages(inscription_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- Vue pour simplifier les conversations
CREATE VIEW IF NOT EXISTS conversation_summary AS
SELECT 
  CASE 
    WHEN sender_id < recipient_id THEN sender_id 
    ELSE recipient_id 
  END AS user1_id,
  CASE 
    WHEN sender_id < recipient_id THEN recipient_id 
    ELSE sender_id 
  END AS user2_id,
  inscription_id,
  MAX(created_at) AS last_message_at,
  COUNT(CASE WHEN is_read = 0 THEN 1 END) AS unread_count,
  (SELECT content FROM messages m2 
   WHERE (m2.sender_id = user1_id AND m2.recipient_id = user2_id)
      OR (m2.sender_id = user2_id AND m2.recipient_id = user1_id)
   ORDER BY m2.created_at DESC 
   LIMIT 1) AS last_message
FROM messages
GROUP BY user1_id, user2_id, inscription_id;
