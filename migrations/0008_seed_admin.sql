-- Seed 0008: Création du compte Super Admin par défaut
-- Date: 2025-12-28
-- Description: Compte super_admin pour gérer la plateforme

-- Mot de passe par défaut: "Admin123!" 
-- Hash bcrypt: $2b$10$ZOVZafCHXZIYdlkFi9BFL.ocbn9ERMSaPxP.On.wD02mqoJAY/LfW
-- IMPORTANT: À changer après première connexion !

-- Super Admin
UPDATE users 
SET password_hash = '$2b$10$ZOVZafCHXZIYdlkFi9BFL.ocbn9ERMSaPxP.On.wD02mqoJAY/LfW'
WHERE id = 1;

-- Guide de test (même mot de passe pour simplifier les tests)
UPDATE users 
SET password_hash = '$2b$10$ZOVZafCHXZIYdlkFi9BFL.ocbn9ERMSaPxP.On.wD02mqoJAY/LfW'
WHERE id = 2;

INSERT OR IGNORE INTO user_profiles (user_id, prenom, nom, tel, formule, payment_status, created_at)
VALUES (
  2,
  'Marie',
  'Dupont',
  '+33612345678',
  NULL,
  'paid',
  CURRENT_TIMESTAMP
);
