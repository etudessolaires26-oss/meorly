# Académie de la Lumière

Application web spirituelle pour l'Académie de la Lumière - Un chemin de guidance intérieure avec un cadre clair et un guide humain.

## 🌟 Aperçu du Projet

L'Académie de la Lumière offre une pratique spirituelle structurée basée sur la mystique juive ancienne (Sefer Raziel et Sefer HaRazin). L'application permet aux utilisateurs de s'inscrire gratuitement, d'écrire leur manifeste personnel, et de recevoir un accompagnement spirituel personnalisé.

## 🔗 URLs

- **Application Web (Sandbox)**: https://3000-ijdjdyk7wwphujd5fn2kw-02b9cc79.sandbox.novita.ai
- **API Health Check**: https://3000-ijdjdyk7wwphujd5fn2kw-02b9cc79.sandbox.novita.ai/api/hello
- **GitHub**: (À configurer)
- **Production Cloudflare**: (À déployer)

## ✅ Fonctionnalités Complétées

### Frontend
- ✅ Landing page minimaliste et moderne avec design sombre/clair
- ✅ Navigation fluide avec scroll animation
- ✅ Formulaire d'inscription interactif avec validation
- ✅ Animations et transitions CSS
- ✅ Design responsive (mobile-first)
- ✅ Typographie optimisée avec Google Fonts (Inter)

### Backend (Hono + Cloudflare Workers)
- ✅ API RESTful avec Hono framework
- ✅ Route POST `/api/inscription` - Créer une inscription
- ✅ Route GET `/api/inscriptions` - Lister toutes les inscriptions
- ✅ Route GET `/api/hello` - Health check
- ✅ CORS configuré pour les API routes

### Base de Données (D1 SQLite)
- ✅ Migration initiale avec table `inscriptions`
- ✅ Seed data avec 3 inscriptions de test
- ✅ Index optimisés pour les requêtes
- ✅ Mode local pour développement (--local flag)

### Infrastructure
- ✅ Configuration PM2 pour déploiement en daemon
- ✅ Git repository initialisé avec .gitignore
- ✅ Scripts npm pour build, dev, et database management
- ✅ Configuration Wrangler pour Cloudflare Pages

## 📊 Architecture de Données

### Table: inscriptions
```sql
- id (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- prenom (TEXT, NOT NULL)
- nom (TEXT, NOT NULL)
- email (TEXT, UNIQUE, NOT NULL)
- tel (TEXT, nullable)
- objectif (TEXT, nullable)
- created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
- status (TEXT, DEFAULT 'pending')
```

### Index:
- `idx_inscriptions_email` sur email
- `idx_inscriptions_created_at` sur created_at
- `idx_inscriptions_status` sur status

## 🚀 Utilisation

### Développement Local

```bash
# 1. Build le projet
npm run build

# 2. Appliquer les migrations D1
npm run db:migrate:local

# 3. Seed la base de données
npm run db:seed

# 4. Démarrer avec PM2
pm2 start ecosystem.config.cjs

# 5. Tester l'application
curl http://localhost:3000/api/hello
```

### Commandes Utiles

```bash
# Gestion PM2
pm2 list                    # Lister les services
pm2 logs webapp --nostream  # Voir les logs
pm2 restart webapp          # Redémarrer
pm2 delete webapp           # Arrêter et supprimer

# Base de données
npm run db:migrate:local    # Appliquer migrations
npm run db:seed             # Seed data
npm run db:reset            # Reset complet de la DB
npm run db:console:local    # Console SQL

# Git
npm run git:status          # Git status
npm run git:commit "msg"    # Commit rapide
npm run git:log             # Voir l'historique

# Nettoyage
npm run clean-port          # Libérer le port 3000
```

## 🎯 Prochaines Étapes Recommandées

### Phase 1: Authentification & Espace Membre (Prioritaire)
- [ ] Système d'authentification (JWT ou OAuth)
- [ ] Dashboard utilisateur personnel
- [ ] Page de profil avec édition
- [ ] Système de session sécurisé

### Phase 2: Manifeste & Petek
- [ ] Interface pour écrire/éditer le manifeste
- [ ] Support audio pour le manifeste oral
- [ ] Génération du Petek personnalisé en hébreu
- [ ] Affichage du Petek avec calligraphie hébraïque
- [ ] Export PDF du Petek

### Phase 3: Accompagnement Guide
- [ ] Système de chat en temps réel (guide ↔ utilisateur)
- [ ] Calendrier de rendez-vous
- [ ] Notifications email/SMS
- [ ] Historique des échanges
- [ ] Suivi de la pratique quotidienne

### Phase 4: Pratique Quotidienne
- [ ] Rappels quotidiens de récitation
- [ ] Tracker de pratique (streak)
- [ ] Journal spirituel
- [ ] Statistiques et progrès

### Phase 5: Mobile Apps
- [ ] Application iOS (React Native / Flutter)
- [ ] Application Android (React Native / Flutter)
- [ ] Notifications push
- [ ] Mode hors-ligne

### Phase 6: Admin Panel
- [ ] Dashboard admin
- [ ] Gestion des inscriptions
- [ ] Assignation des guides
- [ ] Génération de rapports
- [ ] Export de données

## 🛠 Stack Technique

- **Frontend**: HTML5, CSS3 (avec CSS Variables), Vanilla JavaScript
- **Backend**: Hono (lightweight web framework)
- **Runtime**: Cloudflare Workers (edge computing)
- **Base de données**: Cloudflare D1 (SQLite distribué)
- **Build**: Vite
- **Deployment**: Cloudflare Pages
- **Process Manager**: PM2
- **Version Control**: Git

## 📱 Design Principles

1. **Content-First**: Le contenu est prioritaire, design minimaliste
2. **Accessibilité**: ARIA labels, focus states, keyboard navigation
3. **Performance**: Lighthouse score optimisé, edge deployment
4. **Spiritualité**: Design épuré reflétant la pratique spirituelle
5. **Mobile-First**: Responsive design optimisé pour mobile

## 🔐 Sécurité & Confidentialité

- Validation côté serveur pour toutes les entrées utilisateur
- Protection CSRF (à implémenter)
- HTTPS obligatoire en production
- Données sensibles chiffrées (à implémenter)
- Conformité RGPD (mentions légales à compléter)

## 📝 Notes Importantes

- **Santé**: L'accompagnement spirituel ne remplace pas un avis médical
- **Éthique**: Pas d'invocations contre autrui, uniquement ce qui élève l'âme
- **Gratuit**: L'inscription et le premier rendez-vous sont gratuits
- **Sans Engagement**: Les utilisateurs peuvent arrêter à tout moment

## 🌍 Localisation

- **Langue**: Français (fr-FR)
- **Localisation**: Jérusalem, Israël
- **Timezone**: Asia/Jerusalem

## 📞 Contact & Support

- **Adresse**: Western Wall Plaza, Jewish Quarter, Old City, Jerusalem, Israel
- **Email**: (À configurer)
- **Support**: (À configurer)

## 📄 Licence

© 2025 Académie de la Lumière. Tous droits réservés.

---

**Dernière mise à jour**: 2025-12-28  
**Version**: 1.0.0  
**Status**: 🟢 En développement actif
