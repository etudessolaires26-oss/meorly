# 🚀 Guide de déploiement Cloudflare Pages - meorly.com

## 📋 Prérequis

- ✅ Compte Cloudflare Pages (gratuit)
- ✅ Domaine meorly.com ajouté à Cloudflare
- ✅ Code prêt dans le repo GitHub

---

## 🌐 Étape 1 : Préparer le nom de projet Cloudflare

Le projet s'appellera : **meorly**

Pour vérifier/créer le projet :

```bash
# Vérifier l'authentification Cloudflare
npx wrangler whoami

# Créer le projet Pages
npx wrangler pages project create meorly \
  --production-branch main \
  --compatibility-date 2025-12-28
```

---

## 🗄️ Étape 2 : Créer la base de données D1

```bash
# Créer la base de données production
npx wrangler d1 create meorly-production

# Copier le database_id retourné et le mettre dans wrangler.jsonc
```

**Mettre à jour wrangler.jsonc :**
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "meorly-production",
      "database_id": "VOTRE_DATABASE_ID_ICI"  // Remplacer avec l'ID réel
    }
  ]
}
```

---

## 📤 Étape 3 : Appliquer les migrations

```bash
# Appliquer toutes les migrations en production
npx wrangler d1 migrations apply meorly-production
```

---

## 🔐 Étape 4 : Configurer les secrets

```bash
# Configurer la clé Resend
npx wrangler pages secret put RESEND_API_KEY --project-name meorly
# Quand demandé, entrer : re_ZRUsTotQ_3bcSHiNkr5W6Q9CcZwu1AzTB

# Lister les secrets pour vérifier
npx wrangler pages secret list --project-name meorly
```

---

## 🚀 Étape 5 : Build et déploiement

```bash
# Build le projet
npm run build

# Déployer sur Cloudflare Pages
npx wrangler pages deploy dist --project-name meorly

# Vous recevrez 2 URLs :
# - Production: https://meorly.pages.dev
# - Branch: https://main.meorly.pages.dev
```

---

## 🌍 Étape 6 : Connecter votre domaine personnalisé

1. **Allez sur** : https://dash.cloudflare.com
2. **Workers & Pages** → Sélectionnez `meorly`
3. **Custom domains** → Add custom domain
4. **Entrez** : `meorly.com`
5. Cloudflare configure automatiquement les DNS

**Votre site sera accessible sur :**
- ✅ https://meorly.com
- ✅ https://www.meorly.com

---

## 🧪 Étape 7 : Tester le déploiement

```bash
# Tester l'API
curl https://meorly.pages.dev/api/admin/blacklist/list

# Tester la landing page
curl https://meorly.pages.dev/
```

---

## 🔄 Déploiements futurs

Pour les prochains déploiements :

```bash
# Build et déployer en une commande
npm run deploy:prod

# Ou manuellement
npm run build
npx wrangler pages deploy dist --project-name meorly
```

---

## 📊 Meta Info - Sauvegarder le nom du projet

Le nom du projet Cloudflare est maintenant **meorly** - il est important de le retenir pour :
- Les futurs déploiements
- La configuration des secrets
- La gestion des domaines

---

## ❓ Dépannage

### Erreur "Project not found"
```bash
# Créer le projet d'abord
npx wrangler pages project create meorly --production-branch main
```

### Erreur "Database not found"
```bash
# Vérifier les bases de données
npx wrangler d1 list

# Recréer si nécessaire
npx wrangler d1 create meorly-production
```

### Erreur "Authentication failed"
```bash
# Se reconnecter
npx wrangler login
```

---

## 🎯 URLs finales

Après déploiement complet :

**Pages Cloudflare :**
- Production: https://meorly.pages.dev
- Branch main: https://main.meorly.pages.dev

**Domaine personnalisé :**
- Site principal: https://meorly.com
- Avec www: https://www.meorly.com

**Pages clés :**
- Landing: https://meorly.com
- Inscription: https://meorly.com/inscription
- Login: https://meorly.com/login
- Admin Dashboard: https://meorly.com/admin
- Admin Messages: https://meorly.com/admin/messages
- Admin Blacklist: https://meorly.com/admin/blacklist

---

**Prêt à déployer ? Dites-moi quand vous voulez commencer ! 🚀**
