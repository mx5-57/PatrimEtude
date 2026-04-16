/**
 * projects-screen.js
 * Écran de gestion des opérations (liste des projets).
 * S'intègre dans l'interface principale via switchTab('proj').
 */

import {
  loadSettings, saveSettings, pickFolder,
  listOperations, createOperation, deleteOperation
} from './tauri-bridge.js';

let settings = {};
let operations = [];
let onOpenOperation = null; // callback(op) quand on ouvre un projet

export function initProjectsScreen(openCallback) {
  onOpenOperation = openCallback;
}

export async function renderProjectsScreen() {
  const screen = document.getElementById('screen-proj');
  if (!screen) return;

  settings = await loadSettings();
  operations = settings.workspace_path
    ? await listOperations(settings.workspace_path)
    : [];

  screen.innerHTML = buildProjectsHTML();
  attachProjectsEvents();
}

function buildProjectsHTML() {
  const hasWorkspace = !!settings.workspace_path;
  const hasDatabase = !!settings.database_path;

  return `
  <div style="display:flex;flex-direction:column;flex:1;overflow:hidden;background:var(--color-background-tertiary)">

    <!-- Barre de configuration chemins -->
    <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;background:var(--color-background-secondary);border-bottom:0.5px solid var(--color-border-tertiary);flex-shrink:0">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
        <span style="font-size:11px;color:var(--color-text-secondary);white-space:nowrap;flex-shrink:0">Dossier de travail :</span>
        <span style="font-size:11px;color:var(--color-text-primary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono,monospace)"
          id="workspace-display">${settings.workspace_path || '—'}</span>
        <button class="proj-path-btn" id="btn-pick-workspace">Modifier…</button>
      </div>
      <div style="width:0.5px;height:20px;background:var(--color-border-tertiary);flex-shrink:0"></div>
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
        <span style="font-size:11px;color:var(--color-text-secondary);white-space:nowrap;flex-shrink:0">Base de données :</span>
        <span style="font-size:11px;color:var(--color-text-primary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono,monospace)"
          id="database-display">${settings.database_path || '—'}</span>
        <button class="proj-path-btn" id="btn-pick-database">Modifier…</button>
      </div>
    </div>

    <!-- Corps -->
    <div style="flex:1;overflow-y:auto;padding:24px 32px">

      <!-- Header avec bouton créer -->
      <div style="display:flex;align-items:center;margin-bottom:20px">
        <div>
          <div style="font-size:16px;font-weight:500;color:var(--color-text-primary)">Opérations</div>
          <div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px">${operations.length} opération${operations.length !== 1 ? 's' : ''} dans le dossier de travail</div>
        </div>
        <div style="flex:1"></div>
        <button class="proj-cta-btn" id="btn-new-op" ${!hasWorkspace ? 'disabled title="Définir un dossier de travail d\'abord"' : ''}>
          + Nouvelle opération
        </button>
      </div>

      <!-- Message si pas de workspace -->
      ${!hasWorkspace ? `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;background:var(--color-background-secondary);border:0.5px dashed var(--color-border-tertiary);border-radius:var(--border-radius-lg);text-align:center;gap:12px">
        <div style="font-size:32px">📁</div>
        <div style="font-size:14px;font-weight:500;color:var(--color-text-primary)">Aucun dossier de travail défini</div>
        <div style="font-size:12px;color:var(--color-text-secondary);max-width:400px">Choisissez un dossier sur votre disque pour stocker vos opérations. Chaque opération sera enregistrée dans un sous-dossier.</div>
        <button class="proj-cta-btn" id="btn-pick-workspace-2">Choisir un dossier de travail</button>
      </div>
      ` : operations.length === 0 ? `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;background:var(--color-background-secondary);border:0.5px dashed var(--color-border-tertiary);border-radius:var(--border-radius-lg);text-align:center;gap:12px">
        <div style="font-size:32px">🏛️</div>
        <div style="font-size:14px;font-weight:500;color:var(--color-text-primary)">Aucune opération pour l'instant</div>
        <div style="font-size:12px;color:var(--color-text-secondary)">Créez votre première opération pour commencer.</div>
        <button class="proj-cta-btn" id="btn-new-op-2">+ Nouvelle opération</button>
      </div>
      ` : `
      <!-- Grille des opérations -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px" id="op-grid">
        ${operations.map(op => buildOpCard(op)).join('')}
      </div>
      `}
    </div>
  </div>

  <!-- Modal nouvelle opération -->
  <div id="new-op-modal" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,.28);z-index:300;align-items:center;justify-content:center">
    <div style="background:var(--color-background-primary);border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-lg);width:440px;padding:0;display:flex;flex-direction:column;overflow:hidden" onclick="event.stopPropagation()">
      <div style="display:flex;align-items:center;padding:14px 18px;border-bottom:0.5px solid var(--color-border-tertiary)">
        <span style="font-size:13px;font-weight:500;color:var(--color-text-primary);flex:1">Nouvelle opération</span>
        <button onclick="closeNewOpModal()" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--color-text-tertiary);padding:2px 6px;line-height:1">✕</button>
      </div>
      <div style="padding:18px 20px;display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;flex-direction:column;gap:5px">
          <label style="font-size:11px;font-weight:500;color:var(--color-text-secondary);letter-spacing:.04em">NOM DE L'OPÉRATION *</label>
          <input id="new-op-name" class="proj-field" placeholder="ex: Restauration façades principales" autofocus/>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px">
          <label style="font-size:11px;font-weight:500;color:var(--color-text-secondary);letter-spacing:.04em">MAÎTRE D'OUVRAGE</label>
          <input id="new-op-client" class="proj-field" placeholder="ex: Propriété de Vaux-le-Vicomte"/>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px">
          <label style="font-size:11px;font-weight:500;color:var(--color-text-secondary);letter-spacing:.04em">RÉFÉRENCE</label>
          <input id="new-op-ref" class="proj-field" placeholder="ex: RC 2025-047"/>
        </div>
        <div style="font-size:11px;color:var(--color-text-tertiary)" id="new-op-folder-preview"></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:0.5px solid var(--color-border-tertiary);background:var(--color-background-secondary)">
        <button onclick="closeNewOpModal()" style="font-size:12px;padding:5px 14px;border:0.5px solid var(--color-border-secondary);border-radius:6px;background:transparent;color:var(--color-text-primary);cursor:pointer">Annuler</button>
        <button id="btn-confirm-new-op" style="font-size:12px;padding:5px 14px;border:0.5px solid var(--color-border-info);border-radius:6px;background:var(--color-background-info);color:var(--color-text-info);cursor:pointer">Créer l'opération</button>
      </div>
    </div>
  </div>
  `;
}

function buildOpCard(op) {
  const date = new Date(op.updated_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  return `
  <div class="op-card" data-path="${op.path}" onclick="openOp('${op.path}')">
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
      <div style="width:36px;height:36px;border-radius:8px;background:#E6F1FB;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">🏛️</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${op.name}</div>
        <div style="font-size:11px;color:var(--color-text-secondary);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${op.client || 'Sans maître d\'ouvrage'}</div>
      </div>
      <button class="op-card-del" onclick="event.stopPropagation();confirmDeleteOp('${op.path}','${escHtml(op.name)}')" title="Supprimer">×</button>
    </div>
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:10px;padding:2px 7px;border-radius:4px;background:var(--color-background-secondary);color:var(--color-text-secondary);font-variant-numeric:tabular-nums">${op.reference || 'Sans référence'}</span>
      <span style="flex:1"></span>
      <span style="font-size:10px;color:var(--color-text-tertiary)">${date}</span>
    </div>
  </div>`;
}

function escHtml(s) {
  return String(s).replace(/'/g, "\\'");
}

function attachProjectsEvents() {
  document.getElementById('btn-pick-workspace')?.addEventListener('click', pickWorkspace);
  document.getElementById('btn-pick-workspace-2')?.addEventListener('click', pickWorkspace);
  document.getElementById('btn-pick-database')?.addEventListener('click', pickDatabase);
  document.getElementById('btn-new-op')?.addEventListener('click', openNewOpModal);
  document.getElementById('btn-new-op-2')?.addEventListener('click', openNewOpModal);
  document.getElementById('btn-confirm-new-op')?.addEventListener('click', confirmNewOp);
  document.getElementById('new-op-name')?.addEventListener('input', updateFolderPreview);
  document.getElementById('new-op-ref')?.addEventListener('input', updateFolderPreview);
  document.getElementById('new-op-modal')?.addEventListener('click', closeNewOpModal);
  document.getElementById('new-op-name')?.addEventListener('keydown', e => { if (e.key === 'Enter') confirmNewOp(); });
}

async function pickWorkspace() {
  const path = await pickFolder('Choisir le dossier de travail des opérations');
  if (!path) return;
  settings.workspace_path = path;
  await saveSettings(settings);
  await renderProjectsScreen();
}

async function pickDatabase() {
  const path = await pickFolder('Choisir le dossier de la base de données catalogue');
  if (!path) return;
  settings.database_path = path;
  await saveSettings(settings);
  document.getElementById('database-display').textContent = path;
}

function openNewOpModal() {
  const modal = document.getElementById('new-op-modal');
  if (modal) { modal.style.display = 'flex'; document.getElementById('new-op-name')?.focus(); }
}

window.closeNewOpModal = function () {
  const modal = document.getElementById('new-op-modal');
  if (modal) modal.style.display = 'none';
};

function updateFolderPreview() {
  const name = document.getElementById('new-op-name')?.value || '';
  const ref = document.getElementById('new-op-ref')?.value || '';
  const preview = document.getElementById('new-op-folder-preview');
  if (!preview) return;
  if (name || ref) {
    const folder = sanitize(`${ref}_${name}`) || 'nouvelle_operation';
    preview.textContent = `Dossier : ${settings.workspace_path}\\${folder}`;
  } else {
    preview.textContent = '';
  }
}

function sanitize(s) {
  return s.replace(/[^a-zA-Z0-9\-_.\u00C0-\u024F]/g, '_').replace(/__+/g, '_').replace(/^_|_$/g, '');
}

async function confirmNewOp() {
  const name = document.getElementById('new-op-name')?.value?.trim();
  if (!name) { document.getElementById('new-op-name')?.focus(); return; }
  const client = document.getElementById('new-op-client')?.value?.trim() || '';
  const reference = document.getElementById('new-op-ref')?.value?.trim() || '';
  try {
    const op = await createOperation({
      workspacePath: settings.workspace_path,
      name, client, reference,
    });
    closeNewOpModal();
    if (onOpenOperation) onOpenOperation(op);
  } catch (e) {
    alert(`Erreur lors de la création : ${e}`);
  }
}

window.openOp = async function (path) {
  try {
    const data = await loadOperation(path);  // à importer si besoin
    if (onOpenOperation) onOpenOperation({ path, ...data.meta });
  } catch (e) {
    alert(`Erreur lors de l'ouverture : ${e}`);
  }
};

window.confirmDeleteOp = async function (path, name) {
  if (!confirm(`Supprimer définitivement l'opération "${name}" ?\n\nCette action est irréversible.`)) return;
  await deleteOperation(path);
  await renderProjectsScreen();
};

// Import dynamique pour loadOperation
async function loadOperation(opPath) {
  const { loadOperation: _load } = await import('./tauri-bridge.js');
  return _load(opPath);
}
