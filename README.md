# PatrimÉtude Desktop

Logiciel d'étude de prix pour chantiers de monuments historiques.
**Windows** · Tauri + Rust + Vite/JS · ~3 Mo installé

---

## Prérequis

- **Node.js** 18+ : https://nodejs.org
- **Rust** (stable) : https://rustup.rs
- **Microsoft C++ Build Tools** (pour compiler Rust sur Windows) :
  https://visualstudio.microsoft.com/visual-cpp-build-tools/
- **WebView2** (inclus dans Windows 11, sinon télécharger) :
  https://developer.microsoft.com/microsoft-edge/webview2/

---

## Installation

```bash
# 1. Cloner / décompresser le projet
cd patrimetude

# 2. Installer les dépendances JS
npm install

# 3. Installer la CLI Tauri
npm install -g @tauri-apps/cli

# 4. Lancer en mode développement (hot-reload)
npm run tauri dev

# 5. Compiler l'installeur Windows (.msi ou .exe NSIS)
npm run tauri build
# → Le fichier d'installation se trouve dans src-tauri/target/release/bundle/
```

---

## Structure du projet

```
patrimetude/
├── index.html                  # Point d'entrée HTML
├── vite.config.js              # Configuration Vite
├── package.json
│
├── src/                        # Frontend JS
│   ├── main.js                 # Bootstrap : shell, onglets, init
│   ├── tauri-bridge.js         # Couche d'abstraction Tauri ↔ JS
│   ├── projects-screen.js      # Écran Projets (liste des opérations)
│   ├── dossier-screen.js       # ← À créer : interface dossier complète
│   ├── bdd-screen.js           # ← À créer : écran base de données
│   └── styles/
│       └── projects.css        # Styles spécifiques desktop
│
└── src-tauri/                  # Backend Rust
    ├── Cargo.toml
    ├── tauri.conf.json         # Config fenêtre, permissions, bundle
    └── src/
        └── main.rs             # Commandes Tauri : fichiers, opérations, BDD
```

---

## Architecture des données sur disque

```
[Dossier de travail]/
├── RC-2025-047_Vaux-le-Vicomte/   ← dossier d'une opération
│   ├── meta.json                  ← nom, client, référence, dates
│   ├── dossier.json               ← arbre hiérarchique (lots/chapitres/ouvrages + métrés)
│   └── styles.json                ← styles typographiques de l'opération
│
└── Autre-operation/
    ├── meta.json
    ├── dossier.json
    └── styles.json

[Dossier base de données]/
└── catalogue.json                 ← bibliothèque d'ouvrages type avec CCTP et PU
```

Chaque fichier est du JSON lisible et éditable manuellement si besoin.
Les sauvegardes sont atomiques (écriture complète du fichier).

---

## Commandes Tauri disponibles (Rust → JS)

| Commande            | Description                                      |
|---------------------|--------------------------------------------------|
| `load_settings`     | Lit les paramètres (chemins workspace/BDD)       |
| `save_settings`     | Sauvegarde les paramètres                        |
| `list_operations`   | Liste les opérations dans le workspace           |
| `create_operation`  | Crée une nouvelle opération (dossier + fichiers) |
| `load_operation`    | Charge meta + tree + styles d'une opération      |
| `save_operation`    | Sauvegarde tree + styles, met à jour updated_at  |
| `delete_operation`  | Supprime le dossier d'une opération              |
| `load_database`     | Charge le catalogue.json                         |
| `save_database`     | Sauvegarde le catalogue.json                     |

Appel depuis JS :
```js
import { invoke } from '@tauri-apps/api/tauri';
const ops = await invoke('list_operations', { workspacePath: 'C:\\Mes Projets' });
```

Ou via le bridge fourni :
```js
import { listOperations } from './tauri-bridge.js';
const ops = await listOperations('C:\\Mes Projets');
```

---

## Intégration de l'interface dossier

L'interface maquettée (plan + CCTP + Bordereau + Avant-métré) s'intègre dans
`src/dossier-screen.js`. Le schéma d'intégration est :

```js
// src/dossier-screen.js
export function mount(screenEl, op) {
  // op = { path, meta, tree, styles }
  screenEl.innerHTML = buildDossierHTML();   // le HTML de la v9
  initDosPlan(op.tree);
  initStyles(op.styles);
  initAutoSave(op);
}

function initAutoSave(op) {
  // Déclenché à chaque modification de l'arbre
  scheduleAutoSave(() => {
    saveOperation({ opPath: op.path, tree: getCurrentTree(), styles: getCurrentStyles() });
  });
}
```

Le frontend PatrimÉtude v9 est entièrement compatible — il suffit de
l'enrober dans ce module et de brancher les callbacks de sauvegarde.

---

## Roadmap technique

- [ ] Intégrer `dossier-screen.js` (port de la v9 maquettée)
- [ ] Intégrer `bdd-screen.js` (base de données catalogue)
- [ ] Auto-save avec indicateur dans la barre de titre
- [ ] Export DPGF vers Excel (via `calamine` ou script Python embarqué)
- [ ] Export CCTP vers Word (via `docx` crate Rust)
- [ ] Gestion des conflits de sauvegarde (multi-utilisateurs réseau)
- [ ] Mise à jour automatique (`tauri-updater`)
- [ ] Icône et branding final

---

## Raccourcis clavier

| Raccourci        | Action               |
|------------------|----------------------|
| `Ctrl+S`         | Enregistrer          |
| `Ctrl+Z`         | Annuler              |
| `Ctrl+Shift+Z`   | Rétablir             |
| `Ctrl+N`         | Nouvelle opération   |
