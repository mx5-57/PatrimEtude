/**
 * main.js — Point d'entrée PatrimÉtude Desktop
 * Orchestre l'interface principale et la connexion avec Tauri.
 */

import { loadSettings, saveSettings, saveOperation, scheduleAutoSave } from './tauri-bridge.js';
import { renderProjectsScreen, initProjectsScreen } from './projects-screen.js';

// ── État global ───────────────────────────────────────────────────────────────
let currentOp = null;   // { path, meta, tree, styles }
let settings   = {};

// ── Initialisation ────────────────────────────────────────────────────────────
async function init() {
  settings = await loadSettings();
  renderShell();
  initProjectsScreen(onOpenOperation);
  await renderProjectsScreen();
}

// ── Shell HTML principal ──────────────────────────────────────────────────────
function renderShell() {
  document.getElementById('app').innerHTML = `
  <div class="shell" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--color-background-primary);font-family:var(--font-sans,sans-serif)">

    <!-- MENUBAR -->
    <div class="menubar titlebar-drag" id="menubar" style="display:flex;align-items:center;height:36px;border-bottom:0.5px solid var(--color-border-tertiary);background:var(--color-background-secondary);flex-shrink:0;padding:0 8px;gap:2px;position:relative;z-index:50;user-select:none">
      <div class="titlebar-no-drag" style="display:flex;align-items:center;gap:2px;flex:1">
        <div style="font-size:13px;font-weight:500;color:var(--color-text-primary);padding:0 10px 0 4px;border-right:0.5px solid var(--color-border-tertiary);margin-right:6px;display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span style="width:7px;height:7px;border-radius:50%;background:#1D9E75;display:inline-block"></span>PatrimÉtude
        </div>
        <div class="mi" id="mi-f" onclick="toggleMenu('f',this)">Fichier
          <div class="dd">
            <div class="di" onclick="switchTab('proj',document.querySelector('[data-tab=proj]'))">Liste des opérations</div>
            <div class="di" onclick="newOperation()">Nouvelle opération…</div>
            <div class="dsep"></div>
            <div class="di" id="mi-save" onclick="triggerSave()">Enregistrer<span class="dkbd">Ctrl+S</span></div>
            <div class="dsep"></div>
            <div class="di">Exporter DPGF (Excel)</div>
            <div class="di">Exporter CCTP (PDF)</div>
            <div class="di">Exporter CCTP (Word)</div>
          </div>
        </div>
        <div class="mi" id="mi-e" onclick="toggleMenu('e',this)">Édition
          <div class="dd">
            <div class="di off">Annuler<span class="dkbd">Ctrl+Z</span></div>
            <div class="di off">Rétablir<span class="dkbd">Ctrl+Shift+Z</span></div>
            <div class="dsep"></div>
            <div class="di" onclick="openStyles()">Styles du document…</div>
          </div>
        </div>
        <div class="mi" id="mi-a" onclick="toggleMenu('a',this)">Affichage
          <div class="dd">
            <div class="di" onclick="toggleModVis('cctp')"><span id="aff-cctp">✓</span> CCTP</div>
            <div class="di" onclick="toggleModVis('dpgf')"><span id="aff-dpgf">✓</span> Bordereau</div>
            <div class="di" onclick="toggleModVis('metre')"><span id="aff-metre">—</span> Avant-métré</div>
            <div class="dsep"></div>
            <div class="di" onclick="toggleDbSide()">Panneau base de données</div>
            <div class="di" onclick="openStyles()">Styles du document…</div>
          </div>
        </div>
        <!-- Indicateur de sauvegarde -->
        <div class="save-indicator titlebar-no-drag" id="save-indicator" style="margin-left:8px">
          <span class="save-dot"></span>
          <span id="save-status">—</span>
        </div>
      </div>
      <div class="titlebar-no-drag" style="display:flex;height:100%">
        <div class="nav-tab active" data-tab="proj" onclick="switchTab('proj',this)">Projets</div>
        <div class="nav-tab" data-tab="dos" onclick="switchTab('dos',this)">Dossier</div>
        <div class="nav-tab" data-tab="bdd" onclick="switchTab('bdd',this)">Base de données</div>
      </div>
    </div>

    <!-- ÉCRANS -->
    <div id="screen-proj" class="screen active" style="display:flex;flex:1;overflow:hidden;flex-direction:column"></div>
    <div id="screen-dos"  class="screen"        style="display:none;flex:1;overflow:hidden;flex-direction:column"></div>
    <div id="screen-bdd"  class="screen"        style="display:none;flex:1;overflow:hidden;flex-direction:column;align-items:center;justify-content:center;color:var(--color-text-tertiary);font-size:12px">
      <div style="font-size:14px;font-weight:500;color:var(--color-text-primary);margin-bottom:6px">Base de données</div>
      <div>Accessible depuis le panneau latéral du dossier</div>
    </div>
  </div>
  `;
  injectStyles();
  bindKeyboard();
}

function injectStyles() {
  const s = document.createElement('style');
  s.textContent = `
    .screen { display:none; }
    .screen.active { display:flex; }
    .nav-tab { padding:0 13px;font-size:12px;color:var(--color-text-secondary);cursor:pointer;border-bottom:2px solid transparent;display:flex;align-items:center;white-space:nowrap;height:100%;user-select:none }
    .nav-tab:hover { color:var(--color-text-primary) }
    .nav-tab.active { color:var(--color-text-primary);border-bottom-color:var(--color-text-primary) }
    .mi { position:relative;padding:4px 10px;font-size:12px;color:var(--color-text-secondary);cursor:pointer;border-radius:4px;user-select:none }
    .mi:hover,.mi.open { background:var(--color-background-primary);color:var(--color-text-primary) }
    .dd { display:none;position:absolute;top:calc(100% + 4px);left:0;background:var(--color-background-primary);border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);min-width:210px;z-index:300;padding:4px 0;box-shadow:0 4px 16px rgba(0,0,0,.1) }
    .mi.open .dd { display:block }
    .di { padding:6px 14px;font-size:12px;color:var(--color-text-primary);cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:16px;white-space:nowrap }
    .di:hover { background:var(--color-background-secondary) }
    .di.off { color:var(--color-text-tertiary);cursor:default }
    .di.off:hover { background:none }
    .dsep { height:0.5px;background:var(--color-border-tertiary);margin:4px 0 }
    .dkbd { font-size:10px;color:var(--color-text-tertiary);font-family:var(--font-mono) }
  `;
  document.head.appendChild(s);
}

// ── Gestion de l'ouverture d'une opération ────────────────────────────────────
function onOpenOperation(op) {
  currentOp = op;
  // Met à jour le titre de la fenêtre
  document.title = `${op.name} — PatrimÉtude`;
  // Met à jour l'indicateur
  setSaveStatus('saved', `Projet : ${op.reference ? op.reference + ' · ' : ''}${op.name}`);
  // Basculer sur l'onglet Dossier
  switchTab('dos', document.querySelector('[data-tab=dos]'));
  // Charger l'interface dossier avec les données de l'opération
  loadDossierScreen(op);
}

function loadDossierScreen(op) {
  const screen = document.getElementById('screen-dos');
  if (!screen) return;
  // Déléguer au module dossier — en production, importer dynamiquement le module
  // Pour cette intégration, on signale juste que l'opération est chargée
  screen.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;flex:1;flex-direction:column;gap:10px;color:var(--color-text-secondary);font-size:13px">
      <div style="font-size:15px;font-weight:500;color:var(--color-text-primary)">${op.name}</div>
      <div style="font-size:12px">${op.client || ''} ${op.reference ? '· ' + op.reference : ''}</div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:6px">Interface dossier chargée depuis :<br><code style="font-family:var(--font-mono);font-size:10px">${op.path}</code></div>
      <div style="margin-top:16px;font-size:11px;color:var(--color-text-tertiary);text-align:center;max-width:480px">
        En production, cette zone affiche l'interface complète PatrimÉtude<br>
        (plan + CCTP + Bordereau + Avant-métré) intégrée ici depuis <code>dossier-screen.js</code>.
      </div>
    </div>`;
  // En production : import('./dossier-screen.js').then(m => m.mount(screen, op))
}

// ── Auto-save ─────────────────────────────────────────────────────────────────
function triggerSave() {
  if (!currentOp) return;
  setSaveStatus('saving', 'Enregistrement…');
  // En production : récupère tree et styles depuis le store
  saveOperation({
    opPath: currentOp.path,
    tree: currentOp.tree || [],
    styles: currentOp.styles || {},
  })
  .then(() => setSaveStatus('saved', 'Enregistré'))
  .catch(e => setSaveStatus('', `Erreur : ${e}`));
}

function setSaveStatus(state, text) {
  const ind = document.getElementById('save-indicator');
  const lbl = document.getElementById('save-status');
  if (!ind || !lbl) return;
  ind.className = `save-indicator titlebar-no-drag${state ? ' '+state : ''}`;
  lbl.textContent = text;
}

// ── Menus & onglets ───────────────────────────────────────────────────────────
window.toggleMenu = function(id, el) {
  const was = el.classList.contains('open');
  closeMenus();
  if (!was) el.classList.add('open');
};
function closeMenus() { document.querySelectorAll('.mi').forEach(m => m.classList.remove('open')); }
document.addEventListener('click', e => { if (!e.target.closest('.mi')) closeMenus(); });

window.switchTab = function(tab, el) {
  closeMenus();
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  el?.classList.add('active');
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
  const screen = document.getElementById('screen-' + tab);
  if (screen) { screen.classList.add('active'); screen.style.display = 'flex'; }
  if (tab === 'proj') renderProjectsScreen();
};

window.newOperation = function() {
  switchTab('proj', document.querySelector('[data-tab=proj]'));
  setTimeout(() => document.getElementById('btn-new-op')?.click(), 50);
};

// Placeholders pour les fonctions attendues par le menubar
window.toggleModVis = function(m) { /* délégué au module dossier */ };
window.toggleDbSide = function()  { /* délégué au module dossier */ };
window.openStyles   = function()  { /* délégué au module dossier */ };

function bindKeyboard() {
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); triggerSave(); }
  });
}

// ── Démarrage ─────────────────────────────────────────────────────────────────
init().catch(console.error);
