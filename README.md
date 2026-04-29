# RTS00029 - Documentation d'architecture
> Application de suivi des demandes de mise à jour de plans/documents techniques.
Dernière mise à jour : 2026
> 

---

## Sommaire

1. [Vue d'ensemble](## 1. Vue d'ensemble)
2. [Structure du repository GitHub]
3. [Firebase - Ce qui est stocké où]
4. [Structure des données Firestore]
5. [Règles de sécurité]
6. [Rôles et permissions]
7. [Flux de données]
8. [Gestion des utilisateurs]
9. [Déploiement]
10. [Maintenance & opérations courantes]

---

## 1. Vue d'ensemble

```
┌─────────────────────────────────────────────────────┐
│                    UTILISATEUR                       │
│              (navigateur web)                        │
└──────────────────┬──────────────────────────────────┘
                   │ HTTPS
        ┌──────────▼──────────┐
        │    GitHub Pages      │  Hébergement statique
        │   index.html         │  (fichiers publics)
        │   img/logo.png       │
        └──────────┬──────────┘
                   │ Firebase SDK (JS)
        ┌──────────▼──────────┐
        │      Firebase        │  Backend (Google Cloud)
        │                      │
        │  ┌────────────────┐  │
        │  │ Authentication │  │  Identités utilisateurs
        │  └────────────────┘  │
        │  ┌────────────────┐  │
        │  │   Firestore    │  │  Base de données
        │  └────────────────┘  │
        └─────────────────────┘
```

**Principe clé :** il n'y a pas de serveur backend. Le navigateur communique
directement avec Firebase via le SDK JavaScript. La sécurité est assurée par
les **Security Rules Firestore**, pas par un serveur intermédiaire.

---

## 2. Structure du repository

```
ton-repo/                         ← GitHub (code source)
│
├── index.html                    ← Toute l'application (HTML + CSS + JS)
├── img/
│   └── logo.png                  ← Favicon et logo
└── README.md                     ← Ce fichier
```

**Hébergement :** GitHub Pages (branche `main`, dossier racine)
**URL publique :** `https://TON_USERNAME.github.io/TON_REPO/`

---

## 3. Firebase

**Projet Firebase :** `rts00029-5ef6a`**Console :** https://console.firebase.google.com/project/rts00029-5ef6a

### Ce qui est stocké où

| Donnée | Service Firebase | Emplacement |
| --- | --- | --- |
| Identifiants de connexion (email + mdp hashé) | **Authentication** | Géré par Google, non accessible directement |
| Profils utilisateurs (nom, rôle) | **Firestore** | Collection `users/` |
| Demandes actives | **Firestore** | Collection `demandes/` |
| Demandes archivées | **Firestore** | Collection `archives/` |
| Médias joints (images, PDFs) | **Firestore** | Champ `media[]` dans chaque document (base64) |
| Configuration Firebase | **index.html** | Bloc `firebaseConfig` dans le `<script>` |

### Ce qui N'est PAS sur Firebase

| Donnée | Où |
| --- | --- |
| Code source de l'app | GitHub |
| Logo / favicon | GitHub (`img/logo.png`) |
| Historique des versions du code | GitHub (commits) |

### Nota bene sur la clé API Firebase

La clé `apiKey` visible dans `index.html` est **publique par conception**
(documenté par Google). Elle identifie le projet Firebase mais ne donne
aucun accès aux données. La sécurité repose entièrement sur les
**Security Rules Firestore** (voir section 5).

---

## 4. Structure des données Firestore

### Collection `demandes/`

Chaque document représente une demande active.

```
demandes/
└── {id_auto}/
    ├── createdBy     : string   — UID Firebase de l'auteur
    ├── createdAt     : number   — timestamp ms (Date.now())
    ├── date          : string   — "JJ/MM/AAAA" (date saisie par l'utilisateur)
    ├── demandeur     : string   — Nom affiché du demandeur
    ├── refData       : array    — Liste des références
    │   └── [{
    │       ref   : string   — ex: "D12.345_A"
    │       desig : string   — Désignation du plan
    │       desc  : string   — Description de la modification
    │       inc   : string   — Incidence sur stock/en-cours
    │   }]
    ├── media         : array    — Fichiers joints (base64)
    │   └── [{
    │       name : string   — Nom du fichier
    │       type : string   — MIME type (image/png, application/pdf…)
    │       data : string   — Contenu base64 (data URI)
    │   }]
    └── statuts       : object   — État des 4 étapes de validation
        ├── cao  : { val: "a_faire"|"a_fait", ts: null|timestamp }
        ├── prod : { val: "a_faire"|"a_fait", ts: null|timestamp }
        ├── be   : { val: "a_faire"|"a_fait", ts: null|timestamp }
        └── pmi  : { val: "a_faire"|"a_fait", ts: null|timestamp }
```

### Collection `archives/`

Structure identique à `demandes/`, avec un champ supplémentaire :

```
archives/
└── {même id que la demande originale}/
    ├── ... (tous les champs de demandes/)
    └── archivedAt : number — timestamp ms de l'archivage
```

> **Note :** L'ID Firestore est conservé lors de l'archivage.
Une demande archivée a le même ID que quand elle était active.
> 

### Collection `users/`

```
users/
└── {uid_firebase}/          ← L'ID du document = l'UID Firebase Auth
    ├── email               : string   — Adresse email
    ├── nom                 : string   — Prénom Nom (affiché dans l'app)
    ├── role                : string   — "admin" ou "user"
    └── mustChangePassword  : boolean  — true = écran de changement mdp au login
```

---

## 5. Règles de sécurité

Les règles sont configurées dans :
**Firebase Console → Firestore → Règles**

```jsx
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    function isLoggedIn() { return request.auth != null; }

    match /demandes/{id} {
      allow read:   if isLoggedIn();
      allow create: if isLoggedIn()
                    && request.resource.data.createdBy == request.auth.uid;
      allow update: if isAdmin()
                    || (isLoggedIn() && resource.data.createdBy == request.auth.uid);
      allow delete: if isAdmin();
    }

    match /archives/{id} {
      allow read:  if isLoggedIn();
      allow write: if isAdmin();
    }

    match /users/{userId} {
      allow read:  if isLoggedIn() && request.auth.uid == userId;
      allow write: if isAdmin();
    }
  }
}
```

---

## 6. Rôles et permissions

| Action | Admin | Utilisateur |
| --- | --- | --- |
| Voir toutes les demandes | ✅ | ✅ |
| Créer une demande | ✅ | ✅ (son nom auto) |
| Modifier ses propres demandes | ✅ | ✅ |
| Modifier les demandes des autres | ✅ | ❌ |
| Changer les statuts (CAO, Prod…) | ✅ | ❌ (lecture seule) |
| Supprimer une demande | ✅ | ❌ |
| Archiver / Désarchiver | ✅ | ❌ |
| Voir les archives | ✅ | ✅ |
| Champ demandeur libre | ✅ | ❌ (nom fixé) |

---

## 7. Flux de données

### Ouverture de l'app

```
1. Navigateur charge index.html depuis GitHub Pages
2. Firebase SDK s'initialise (firebaseConfig)
3. onAuthStateChanged() vérifie si une session existe
   ├── Non connecté → affiche l'écran de login
   └── Connecté     → récupère profil dans users/{uid}
                      → si mustChangePassword=true → écran changement mdp
                      → sinon → lance les listeners onSnapshot()
```

### Listeners temps réel (onSnapshot)

```
Firestore "demandes/"  ──onSnapshot──► renderActif()   ← mise à jour auto
Firestore "archives/"  ──onSnapshot──► renderArchive() ← mise à jour auto
```

Quand un utilisateur modifie une donnée, **tous les utilisateurs connectés**
voient la mise à jour en temps réel sans recharger la page.

### Création d'une demande

```
Utilisateur remplit le formulaire
→ submitForm() valide les champs
→ doSubmit() appelle fsCreate()
→ addDoc(collection(firestore, 'demandes'), {...})
→ Firestore confirme → onSnapshot() déclenche renderActif()
```

### Archivage

```
fsArchive(fid)
→ Lecture du document dans "demandes/"
→ Copie dans "archives/" avec archivedAt
→ Suppression de "demandes/"
→ Les deux onSnapshot() se déclenchent automatiquement
```

---

## 8. Gestion des utilisateurs

### Créer un nouvel utilisateur

1. **Firebase Console → Authentication → Users → Ajouter un utilisateur**
    - Saisir email + mot de passe provisoire
    - Copier l'**UID** généré
2. **Firebase Console → Firestore → Collection `users` → Ajouter un document**
    - ID du document = l'UID copié (obligatoire)
    - Champs à renseigner :
    
    | Champ | Valeur |
    | --- | --- |
    | `email` | adresse@email.com |
    | `nom` | Prénom Nom |
    | `role` | `admin` ou `user` |
    | `mustChangePassword` | `true` |
    
    Avec `mustChangePassword: true`, l'utilisateur sera invité à définir
    son propre mot de passe lors de sa première connexion.
    

### Changer le rôle d'un utilisateur

**Firestore → `users/{uid}` → modifier le champ `role`**
Effectif immédiatement (au prochain rechargement de l'app par l'utilisateur).

### Supprimer un utilisateur

1. **Authentication → Users → Supprimer** (supprime les identifiants)
2. **Firestore → `users/{uid}` → Supprimer le document** (supprime le profil)

> Les demandes créées par cet utilisateur restent dans Firestore.
> 

---

## 9. Déploiement

### Mettre à jour l'application

```powershell
# Depuis le dossier du projet sur Windows
git add .
git commit -m "Description de la modification"
git push origin main
# GitHub Pages se met à jour automatiquement en ~1 minute
```

### Domaines autorisés Firebase

Pour que Firebase Auth accepte les connexions depuis GitHub Pages :
**Firebase Console → Authentication → Settings → Authorized domains**
→ `TON_USERNAME.github.io` doit être dans la liste.

---

## 10. Maintenance

### Surveiller l'utilisation Firebase

**Firebase Console → Usage and billing**

- Firestore : 50 000 lectures/jour et 20 000 écritures/jour gratuits (Spark plan)
- Authentication : 10 000 authentifications/mois gratuites

> Avec une utilisation normale (< 10 utilisateurs, < 100 demandes),
le projet reste dans le plan gratuit indéfiniment.
> 

### Sauvegarder les données Firestore

**Firebase Console → Firestore → Import/Export**
ou via Google Cloud Console → Cloud Storage.

Il est recommandé d'exporter les données mensuellement.

### Limites à connaître

| Limite | Valeur | Impact |
| --- | --- | --- |
| Taille max d'un document Firestore | 1 Mo | Médias en base64 volumineux |
| Taille max d'un champ string | 1 Mo | Idem |
| Médias joints | Stockés en base64 dans Firestore | Si > 500 Ko par fichier, envisager Firebase Storage |

> **Si les médias deviennent un problème :** migrer vers Firebase Storage
(service séparé, stockage de fichiers binaires). Les documents Firestore
stockeraient alors uniquement l'URL du fichier au lieu du base64.
>
