# Guide de Configuration du Domaine Professionnel EasyFact

Ce guide présente la procédure pour remplacer l'adresse de développement temporaire `*.vercel.app` par un nom de domaine de classe entreprise (ex: **`easyfact.africa`** ou **`easyfact.com`**).

---

## 🌟 Noms de Domaine Recommandés

1. **`easyfact.africa`** *(Recommandé - Idéal pour le marché SYSCOHADA UEMOA / CEMAC)*
   - Renforce l'image de marque Fintech N°1 en Afrique de l'Ouest et Centrale.
2. **`easyfact.com`** *(Standard Corporate International)*
   - Domaine universel haut de gamme.
3. **`easyfact.co`** ou **`easyfact.app`**
   - Alternative moderne pour les plateformes SaaS financières.

---

## 🛠️ Procédure en 3 Étapes pour Relier le Domaine sur Vercel

### Étape 1 : Obtenir le Nom de Domaine
Achetez le nom de domaine souhaité (ex: `easyfact.africa` ou `easyfact.com`) sur un registrar comme **Namecheap**, **GoDaddy**, **OVH**, ou directement depuis l'interface Vercel Domains.

---

### Étape 2 : Ajouter le Domaine dans la Console Vercel
1. Ouvrez votre tableau de bord Vercel :  
   👉 [**https://vercel.com/imorousalem8-5162s-projects/easy-fact/settings/domains**](https://vercel.com/imorousalem8-5162s-projects/easy-fact/settings/domains)
2. Cliquez sur le bouton **"Add"**.
3. Saisissez votre nouveau nom de domaine : `easyfact.africa` (ou `easyfact.com`).
4. Sélectionnez la redirection recommandée : `Add easyfact.africa and redirect www.easyfact.africa to it`.

---

### Étape 3 : Configurer les DNS chez votre Registrar
Dans le panneau de configuration de votre fournisseur de nom de domaine (Namecheap, OVH, GoDaddy...), ajoutez ces 2 enregistrements DNS :

| Type | Nom / Hôte | Valeur / Cible | Description |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `76.76.21.21` | Pointe le domaine principal vers Vercel |
| **CNAME** | `www` | `cname.vercel-dns.com` | Redirige le sous-domaine www |

---

## 🔒 Certificat SSL & HTTPS Automatique
Dès que les enregistrements DNS sont renseignés :
- Vercel génère et installe automatiquement un **certificat SSL gratuit (HTTPS 256-bit)** avec le cadenas de sécurité vert.
- L'adresse temporaire `*.vercel.app` est automatiquement masquée au profit de votre marque officielle **`https://easyfact.africa`** !
