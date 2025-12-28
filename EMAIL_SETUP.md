# 📧 Configuration de l'envoi d'emails avec Resend

## Pourquoi Resend ?

Resend est un service d'envoi d'email moderne, simple et compatible avec Cloudflare Workers. Il offre:
- API simple et rapide
- 100 emails/jour gratuits
- Excellent pour les Workers/Pages
- Support TypeScript natif

## 🚀 Setup rapide (5 minutes)

### 1. Créer un compte Resend

1. Allez sur https://resend.com
2. Créez un compte gratuit (100 emails/jour)
3. Vérifiez votre email

### 2. Obtenir votre clé API

1. Dans votre dashboard Resend: https://resend.com/api-keys
2. Cliquez sur "Create API Key"
3. Nom: `Académie Lumière Dev`
4. Permission: **Full Access**
5. Copiez la clé (commence par `re_...`)

### 3. Configurer localement (.dev.vars)

Éditez le fichier `.dev.vars`:

```bash
RESEND_API_KEY=re_votre_cle_api_ici
FROM_EMAIL=noreply@academie-lumiere.fr
ADMIN_EMAIL=admin@academie-lumiere.fr
```

**⚠️ IMPORTANT**: Ce fichier est dans `.gitignore` - ne le commitez JAMAIS!

### 4. Configurer votre domaine (recommandé)

Pour envoyer depuis votre propre domaine (ex: `noreply@academie-lumiere.fr`):

1. Dans Resend Dashboard → **Domains**
2. Add Domain: `academie-lumiere.fr`
3. Ajoutez les DNS records fournis dans votre DNS
4. Attendez la vérification (quelques minutes)

**Sans domaine**: Utilisez `onboarding@resend.dev` (pour tests uniquement)

### 5. Tester localement

```bash
cd /home/user/webapp
npm run build
pm2 restart webapp

# Tester avec l'inscription #10
curl -X POST http://localhost:3000/api/admin/validate-payment \
  -H "Content-Type: application/json" \
  -d '{"inscription_id": 10}'
```

Vérifiez les logs:
```bash
pm2 logs webapp --nostream | grep -E "Email|✅|❌"
```

### 6. Déployer en production

Pour Cloudflare Pages, définissez le secret:

```bash
# Configurez d'abord setup_cloudflare_api_key
npx wrangler pages secret put RESEND_API_KEY --project-name webapp
# Entrez votre clé API Resend quand demandé
```

## 📨 Template d'email

L'email envoyé contient:
- ✨ Message de bienvenue personnalisé
- 🔐 Identifiants de connexion (email + mot de passe temporaire)
- 🎁 Détails du parcours spirituel:
  - Petek personnalisé (code + thème)
  - Psaumes attribués (quantité)
  - Anges protecteurs (quantité)
  - Formule choisie
- 🔗 Bouton de connexion direct
- 📅 Prochaines étapes

## 🧪 Mode développement sans Resend

Si vous n'avez pas encore de clé Resend, l'application fonctionne quand même:
- Les comptes sont créés normalement
- L'email n'est pas envoyé (log d'erreur)
- Le mot de passe temporaire est affiché dans les logs
- Aucun blocage du workflow

## 🔧 Dépannage

### Erreur: "RESEND_API_KEY non configurée"

1. Vérifiez que `.dev.vars` existe
2. Vérifiez que la clé commence par `re_`
3. Restart: `pm2 restart webapp`

### Email non reçu

1. Vérifiez les logs: `pm2 logs webapp --nostream`
2. Vérifiez votre domaine est vérifié dans Resend
3. Vérifiez les spam/indésirables
4. Utilisez `onboarding@resend.dev` pour tests

### Erreur 403 Forbidden

- Votre domaine n'est pas vérifié
- Utilisez `onboarding@resend.dev` temporairement

## 📊 Alternatives à Resend

Si vous préférez un autre service:

**SendGrid** (classique, robuste):
```typescript
// Remplacer fetch('https://api.resend.com/emails')
// Par fetch('https://api.sendgrid.com/v3/mail/send')
```

**Mailgun** (puissant):
```typescript
// fetch('https://api.mailgun.net/v3/YOUR_DOMAIN/messages')
```

**Email natif Cloudflare** (Workers Email Routing - gratuit):
- Plus complexe à configurer
- Nécessite un domaine sur Cloudflare

## 🎯 Limites du plan gratuit

**Resend Free**:
- 100 emails/jour
- 3 000 emails/mois
- 1 domaine
- Support communautaire

**Pour passer en production**: Plan Pro à $20/mois (50 000 emails/mois)

## 📖 Documentation

- Resend Docs: https://resend.com/docs
- Resend + Cloudflare: https://resend.com/docs/send-with-cloudflare-workers
- Dashboard: https://resend.com/emails (voir les emails envoyés)
