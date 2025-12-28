# 📧 Guide de vérification du domaine meorly.com sur Resend

## ✅ Ce qui est déjà fait
- ✅ Compte Resend créé
- ✅ Clé API configurée : `re_ZRUsTotQ_3bcSHiNkr5W6Q9CcZwu1AzTB`
- ✅ Code mis à jour pour utiliser `noreply@meorly.com`

---

## 🚀 Ce qu'il faut faire maintenant (5-10 minutes)

### Étape 1 : Ajouter le domaine sur Resend

1. **Connectez-vous** à Resend : https://resend.com/login
2. **Allez dans** : https://resend.com/domains
3. **Cliquez** sur le bouton "Add Domain"
4. **Entrez** : `meorly.com` (sans www, sans http://)
5. **Cliquez** "Add"

---

### Étape 2 : Copier les DNS records

Resend va vous afficher **3 DNS records**. Notez-les :

**Record 1 - SPF (Protection anti-spam)**
```
Type: TXT
Name: @ (ou meorly.com)
Value: v=spf1 include:_spf.resend.com ~all
```

**Record 2 - DKIM (Signature d'email)**
```
Type: TXT
Name: resend._domainkey
Value: [Une longue chaîne unique - copiez-la depuis Resend]
```

**Record 3 - DMARC (Politique d'email)**
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; pct=100; rua=mailto:dmarc@resend.com
```

---

### Étape 3 : Ajouter les DNS records chez votre hébergeur

**Où est hébergé meorly.com ?**

#### 🔹 Si c'est chez **Cloudflare** :
1. Allez sur https://dash.cloudflare.com
2. Cliquez sur votre domaine `meorly.com`
3. Allez dans l'onglet **DNS**
4. Cliquez "Add record" pour chaque record
5. Ajoutez les 3 records TXT

#### 🔹 Si c'est chez **OVH** :
1. Allez sur https://www.ovh.com/manager/
2. Cliquez sur `meorly.com` dans la section "Domaines"
3. Allez dans l'onglet **Zone DNS**
4. Cliquez "Ajouter une entrée"
5. Choisissez "TXT" pour chaque record
6. Ajoutez les 3 records

#### 🔹 Si c'est chez **Namecheap** :
1. Allez sur https://ap.www.namecheap.com/
2. Domain List → Manage → Advanced DNS
3. Cliquez "Add New Record"
4. Type: TXT Record
5. Ajoutez les 3 records

#### 🔹 Si c'est chez **GoDaddy** :
1. Allez sur https://dcc.godaddy.com/
2. My Products → Domains → DNS
3. Cliquez "Add" sous DNS Records
4. Type: TXT
5. Ajoutez les 3 records

---

### Étape 4 : Vérification (5-15 minutes)

1. **Attendez** 5-15 minutes que les DNS se propagent
2. **Retournez** sur https://resend.com/domains
3. **Resend va vérifier automatiquement** (rafraîchissez la page)
4. Quand c'est **✅ Verified**, c'est bon !

---

## 🧪 Tester l'envoi après vérification

Une fois le domaine vérifié, testez :

```bash
# Dans votre terminal local ou sandbox
curl -X POST http://localhost:3000/api/admin/validate-payment \
  -H "Content-Type: application/json" \
  -d '{"inscription_id": 13}'
```

L'email sera envoyé depuis `noreply@meorly.com` vers n'importe quel email client !

---

## ❓ Problèmes courants

### Erreur "Domain not verified"
- Attendez 15 minutes de plus
- Vérifiez que les DNS records sont corrects
- Utilisez un vérificateur DNS : https://mxtoolbox.com/SuperTool.aspx

### Erreur 403 "validation_error"
- Le domaine n'est pas encore vérifié
- Attendez la vérification complète sur Resend

### Les emails vont dans spam
- Assurez-vous que les 3 records (SPF, DKIM, DMARC) sont ajoutés
- Attendez 24h pour la pleine propagation

---

## 📊 Limites du plan gratuit Resend

- ✅ **100 emails/jour** vers n'importe qui
- ✅ **3 000 emails/mois**
- ✅ **1 domaine** (meorly.com)
- ✅ Support communautaire

**Pour passer au plan Pro ($20/mois) :**
- 50 000 emails/mois
- Support prioritaire
- Analytics avancés

---

## 🎯 Checklist

- [ ] Ajouter meorly.com sur Resend
- [ ] Copier les 3 DNS records
- [ ] Ajouter les DNS chez votre hébergeur
- [ ] Attendre la vérification (5-15 min)
- [ ] Vérifier que ✅ Verified sur Resend
- [ ] Tester l'envoi d'email
- [ ] Vérifier la réception dans la boîte du client

---

**Une fois terminé, revenez me dire "C'est vérifié !" et on pourra tester l'envoi vers n'importe quel email ! 🎉**
