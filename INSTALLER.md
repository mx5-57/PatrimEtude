# Comment obtenir l'installeur PatrimÉtude .exe
# Guide pas à pas — aucune connaissance technique requise

---

## ÉTAPE 1 — Créer un compte GitHub (gratuit)

1. Aller sur https://github.com
2. Cliquer "Sign up"
3. Renseigner email, mot de passe, nom d'utilisateur
4. Valider l'email reçu

---

## ÉTAPE 2 — Créer un nouveau dépôt

1. Une fois connecté, cliquer le bouton vert "New" (en haut à gauche)
2. Remplir :
   - Repository name : `patrimetude`
   - Visibility : **Private** (recommandé)
   - Ne rien cocher d'autre
3. Cliquer "Create repository"

---

## ÉTAPE 3 — Uploader les fichiers

Sur la page du dépôt vide qui s'affiche :

1. Cliquer "uploading an existing file" (lien en bas de page)
2. Décompresser le fichier `patrimetude-desktop.zip` sur votre bureau
3. Glisser-déposer le contenu du dossier `patrimetude/` dans la zone GitHub
   ⚠️  Uploader le CONTENU du dossier (pas le dossier lui-même)
   Les fichiers à la racine doivent être : index.html, package.json, vite.config.js, README.md
   Et les dossiers : src/, src-tauri/, .github/

4. En bas de page, écrire dans "Commit changes" : `Initial commit`
5. Cliquer "Commit changes"

---

## ÉTAPE 4 — Attendre la compilation (15-20 minutes)

La compilation démarre automatiquement.

Pour suivre la progression :
1. Cliquer l'onglet "Actions" dans votre dépôt GitHub
2. Vous voyez "Compiler PatrimÉtude Windows" en cours (cercle orange)
3. Cliquer dessus pour voir les étapes en temps réel
4. Quand tout est vert ✅ : la compilation est terminée

---

## ÉTAPE 5 — Télécharger l'installeur

1. Dans l'onglet Actions, cliquer sur la compilation terminée
2. Descendre jusqu'à la section "Artifacts"
3. Cliquer "PatrimEtude-Windows-Setup" pour télécharger un .zip
4. Décompresser ce .zip → vous obtenez le fichier .exe
5. Double-cliquer le .exe pour installer PatrimÉtude

---

## Pour les mises à jour suivantes

À chaque fois que vous modifiez le code et uploadez sur GitHub,
la compilation redémarre automatiquement et un nouvel installeur est disponible.

La deuxième compilation est beaucoup plus rapide (~5 min) grâce au cache Rust.

---

## En cas de problème

Si la compilation échoue (croix rouge dans Actions) :
1. Cliquer sur la compilation échouée
2. Cliquer sur l'étape rouge
3. Copier le message d'erreur et le partager pour diagnostic
