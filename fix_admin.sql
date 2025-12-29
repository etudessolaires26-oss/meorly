-- Créer les utilisateurs admin s'ils n'existent pas
INSERT OR IGNORE INTO users (id, email, password_hash, role, created_at)
VALUES 
  (1, 'admin@academie-lumiere.fr', '$2b$10$ZOVZafCHXZIYdlkFi9BFL.ocbn9ERMSaPxP.On.wD02mqoJAY/LfW', 'super_admin', CURRENT_TIMESTAMP),
  (2, 'guide@academie-lumiere.fr', '$2b$10$ZOVZafCHXZIYdlkFi9BFL.ocbn9ERMSaPxP.On.wD02mqoJAY/LfW', 'guide', CURRENT_TIMESTAMP);

-- Créer le profil du guide
INSERT OR IGNORE INTO user_profiles (user_id, prenom, nom, tel, formule, payment_status, created_at)
VALUES (2, 'Marie', 'Dupont', '+33612345678', NULL, 'paid', CURRENT_TIMESTAMP);
