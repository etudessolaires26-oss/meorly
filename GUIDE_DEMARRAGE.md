# 🌟 Guide de Démarrage - Académie de la Lumière

## ✅ Ce qui est déjà fait

### Application Web Complète
- ✅ Landing page minimaliste et spirituelle
- ✅ Design responsive (mobile + desktop)
- ✅ Animations et transitions fluides
- ✅ Formulaire d'inscription fonctionnel
- ✅ API REST avec Hono backend
- ✅ Base de données D1 (SQLite)
- ✅ Page admin pour gérer les inscriptions
- ✅ Git repository initialisé
- ✅ Documentation complète

### URLs d'accès
- **Application**: https://3000-ijdjdyk7wwphujd5fn2kw-02b9cc79.sandbox.novita.ai
- **Page Admin**: https://3000-ijdjdyk7wwphujd5fn2kw-02b9cc79.sandbox.novita.ai/admin
- **API Health**: https://3000-ijdjdyk7wwphujd5fn2kw-02b9cc79.sandbox.novita.ai/api/hello
- **API Inscriptions**: https://3000-ijdjdyk7wwphujd5fn2kw-02b9cc79.sandbox.novita.ai/api/inscriptions

## 🚀 Commandes Essentielles

### Démarrage Rapide
```bash
cd /home/user/webapp
npm run build
pm2 start ecosystem.config.cjs
```

### Gestion PM2
```bash
pm2 list                    # Voir les services
pm2 logs webapp --nostream  # Voir les logs
pm2 restart webapp          # Redémarrer
pm2 delete webapp           # Arrêter
```

### Base de Données
```bash
npm run db:migrate:local    # Appliquer migrations
npm run db:seed             # Ajouter données test
npm run db:reset            # Reset complet
npm run db:console:local    # Console SQL
```

### Tests
```bash
curl http://localhost:3000/api/hello
curl http://localhost:3000/api/inscriptions
```

## 📊 Structure du Projet

```
webapp/
├── src/
│   └── index.tsx           # Backend Hono + routes API
├── migrations/
│   └── 0001_initial_schema.sql  # Schema DB
├── public/                 # Assets statiques
├── dist/                   # Build output
├── ecosystem.config.cjs    # Config PM2
├── wrangler.jsonc          # Config Cloudflare
├── package.json            # Dependencies
└── README.md              # Documentation
```

## 🎯 Prochaines Étapes Recommandées

### 1. Authentification (PRIORITAIRE)
- [ ] Implémenter JWT ou OAuth
- [ ] Créer un système de login/register
- [ ] Protéger les routes admin
- [ ] Dashboard utilisateur personnel

### 2. Manifeste & Petek
- [ ] Interface d'écriture du manifeste
- [ ] Support enregistrement audio
- [ ] Génération du Petek en hébreu
- [ ] Export PDF du Petek

### 3. Chat avec le Guide
- [ ] Système de chat temps réel
- [ ] Notifications
- [ ] Historique des messages
- [ ] Assignation des guides

### 4. Applications Mobiles
- [ ] App iOS (React Native / Flutter)
- [ ] App Android (React Native / Flutter)
- [ ] Synchronisation cloud
- [ ] Notifications push

## 🔐 Sécurité

Pour la production, penser à :
- [ ] Ajouter authentification sur /admin
- [ ] Configurer HTTPS (Cloudflare le fait automatiquement)
- [ ] Ajouter rate limiting sur les API
- [ ] Valider toutes les entrées utilisateur
- [ ] Chiffrer les données sensibles
- [ ] Configurer CORS correctement

## 📱 Déploiement sur Cloudflare Pages

```bash
# 1. Configurer l'API token Cloudflare
# Aller dans Deploy tab pour configurer

# 2. Build et deploy
npm run build
wrangler pages deploy dist --project-name webapp
```

## 🆘 Dépannage

### Port 3000 occupé
```bash
fuser -k 3000/tcp
```

### Reset de la base de données
```bash
npm run db:reset
```

### Rebuild complet
```bash
rm -rf dist .wrangler
npm run build
npm run db:migrate:local
pm2 restart webapp
```

## 📞 Support

Pour toute question sur le projet :
- Consulter le README.md
- Vérifier les logs PM2
- Tester les endpoints API

---

**Version**: 1.0.0  
**Date**: 2025-12-28  
**Status**: ✅ Prêt pour développement
