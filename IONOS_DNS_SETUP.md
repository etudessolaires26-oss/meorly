# 📧 Guide IONOS : Ajouter les DNS records pour Resend

## 🎯 Objectif
Ajouter 3 enregistrements DNS TXT chez IONOS pour vérifier meorly.com sur Resend.

---

## 📋 Étape par étape IONOS

### 1. Connexion IONOS
- URL : https://login.ionos.fr/
- Connectez-vous avec vos identifiants

### 2. Accéder aux DNS
1. Cliquez sur **"Domaines & SSL"** dans le menu
2. Trouvez et cliquez sur **meorly.com**
3. Cliquez sur **"Gérer les DNS"** ou **"DNS"**

### 3. Interface IONOS DNS
Vous verrez une liste d'enregistrements existants comme :
- A records
- AAAA records
- MX records
- etc.

**Cherchez le bouton** : 
- "Ajouter un enregistrement"
- "+ Ajouter"
- "Add record"

---

## 📝 Les 3 records à ajouter

### ✅ Record 1 - SPF (Anti-spam)

**Cliquez "Ajouter un enregistrement"**

| Champ | Valeur |
|-------|--------|
| Type | `TXT` |
| Nom/Host/Hôte | Laissez **VIDE** ou mettez `@` |
| Valeur/Value/Contenu | `v=spf1 include:_spf.resend.com ~all` |
| TTL | Laissez par défaut (3600) |

**Cliquez "Enregistrer"**

---

### ✅ Record 2 - DKIM (Signature email)

**Cliquez "Ajouter un enregistrement"**

| Champ | Valeur |
|-------|--------|
| Type | `TXT` |
| Nom/Host/Hôte | `resend._domainkey` |
| Valeur/Value/Contenu | Copiez la **longue chaîne** depuis Resend (commence par `p=MIGfMA0...`) |
| TTL | Laissez par défaut (3600) |

**Cliquez "Enregistrer"**

⚠️ **Note IONOS** : IONOS peut automatiquement ajouter `.meorly.com` au nom.
- Vous verrez : `resend._domainkey.meorly.com`
- C'est **NORMAL et CORRECT** ✅

---

### ✅ Record 3 - DMARC (Politique email)

**Cliquez "Ajouter un enregistrement"**

| Champ | Valeur |
|-------|--------|
| Type | `TXT` |
| Nom/Host/Hôte | `_dmarc` |
| Valeur/Value/Contenu | `v=DMARC1; p=none; pct=100; rua=mailto:dmarc@resend.com` |
| TTL | Laissez par défaut (3600) |

**Cliquez "Enregistrer"**

⚠️ **Note IONOS** : IONOS peut automatiquement ajouter `.meorly.com` au nom.
- Vous verrez : `_dmarc.meorly.com`
- C'est **NORMAL et CORRECT** ✅

---

## ✅ Vérification finale sur IONOS

Après avoir ajouté les 3 records, vous devriez voir dans votre liste DNS :

```
Type    Nom/Host                      Valeur
────────────────────────────────────────────────────────────────
TXT     meorly.com (ou @)            v=spf1 include:_spf.resend.com ~all
TXT     resend._domainkey...         p=MIGfMA0GCSqGSI... (très long)
TXT     _dmarc.meorly.com            v=DMARC1; p=none; pct=100; rua=mailto:dmarc@resend.com
```

---

## ⏱️ Temps de propagation

**IONOS** : Généralement **5 à 15 minutes**

Pour vérifier la propagation :
1. Allez sur https://mxtoolbox.com/SuperTool.aspx
2. Tapez : `meorly.com`
3. Sélectionnez "TXT Lookup"
4. Vérifiez que les 3 records apparaissent

---

## 🔍 Vérification sur Resend

1. Retournez sur https://resend.com/domains
2. Rafraîchissez la page toutes les 2-3 minutes
3. Attendez que le statut passe de ⏳ **Pending** à ✅ **Verified**

**Temps moyen pour IONOS :** 10 minutes

---

## ❓ Problèmes courants IONOS

### Erreur "Enregistrement en double"
- Un record TXT similaire existe déjà
- **Solution** : Supprimez l'ancien record SPF/DKIM/DMARC et ajoutez le nouveau

### IONOS ajoute automatiquement le domaine
- `resend._domainkey` devient `resend._domainkey.meorly.com`
- **C'est normal** ✅ Ne changez rien !

### TTL trop court ou trop long
- IONOS recommande 3600 (1 heure)
- **Solution** : Laissez la valeur par défaut

### Valeur DKIM trop longue
- IONOS peut avoir une limite de caractères
- **Solution** : Contactez le support IONOS ou utilisez l'éditeur de zone avancé

---

## 📞 Support IONOS

Si vous rencontrez des problèmes :
- **Email** : support@ionos.fr
- **Téléphone** : 0970 808 911 (France)
- **Chat** : Disponible sur login.ionos.fr

---

## ✅ Checklist complète

- [ ] Connexion à IONOS
- [ ] Accès à la gestion DNS de meorly.com
- [ ] Ajout du record SPF (@ ou vide)
- [ ] Ajout du record DKIM (resend._domainkey)
- [ ] Ajout du record DMARC (_dmarc)
- [ ] Vérification des 3 records dans la liste
- [ ] Attente 10-15 minutes
- [ ] Vérification sur mxtoolbox.com
- [ ] Vérification ✅ Verified sur Resend
- [ ] Test d'envoi d'email

---

**Une fois que Resend affiche ✅ Verified, revenez me dire "C'est vérifié !" et on testera l'envoi ! 🎉**
