/**
 * tauri-bridge.js
 * Couche d'abstraction entre le frontend PatrimÉtude et les commandes Rust/Tauri.
 * En mode dev (navigateur), utilise le localStorage comme fallback.
 */

// Détecte si on tourne dans Tauri ou dans un navigateur
const IS_TAURI = typeof window.__TAURI__ !== 'undefined';

let invoke, dialog;

if (IS_TAURI) {
  invoke = window.__TAURI__.invoke;
  dialog = window.__TAURI__.dialog;
}

// ── Fallback localStorage pour dev navigateur ─────────────────────────────────

const LS = {
  get: (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
  remove: (key) => localStorage.removeItem(key),
  keys: (prefix) => Object.keys(localStorage).filter(k => k.startsWith(prefix)),
};

// ── Settings ──────────────────────────────────────────────────────────────────

export async function loadSettings() {
  if (IS_TAURI) return await invoke('load_settings');
  return LS.get('pm_settings') || {};
}

export async function saveSettings(settings) {
  if (IS_TAURI) return await invoke('save_settings', { settings });
  LS.set('pm_settings', settings);
}

// ── Sélection de dossier ──────────────────────────────────────────────────────

export async function pickFolder(title = 'Choisir un dossier') {
  if (IS_TAURI) {
    return await dialog.open({
      directory: true,
      multiple: false,
      title,
    });
  }
  // Fallback : prompt en dev navigateur
  const p = prompt(`[Dev] Chemin du dossier (${title}) :`, 'C:\\PatrimEtude\\Dossiers');
  return p || null;
}

// ── Opérations ────────────────────────────────────────────────────────────────

export async function listOperations(workspacePath) {
  if (!workspacePath) return [];
  if (IS_TAURI) return await invoke('list_operations', { workspacePath });
  // Fallback localStorage
  return LS.keys('pm_op_').map(k => LS.get(k)).filter(Boolean);
}

export async function createOperation({ workspacePath, name, client, reference }) {
  if (IS_TAURI) {
    return await invoke('create_operation', { workspacePath, name, client, reference });
  }
  // Fallback
  const id = Date.now().toString(16);
  const now = new Date().toISOString();
  const op = {
    id, name, client, reference,
    created_at: now, updated_at: now,
    path: `${workspacePath}\\${reference}_${name}`,
  };
  LS.set(`pm_op_${id}`, op);
  LS.set(`pm_tree_${id}`, []);
  LS.set(`pm_styles_${id}`, null);
  return op;
}

export async function loadOperation(opPath) {
  if (IS_TAURI) return await invoke('load_operation', { opPath });
  // Fallback : chercher par path dans le LS
  const ops = LS.keys('pm_op_').map(k => LS.get(k)).filter(Boolean);
  const op = ops.find(o => o.path === opPath);
  if (!op) throw new Error('Opération introuvable');
  return {
    meta: op,
    tree: LS.get(`pm_tree_${op.id}`) || [],
    styles: LS.get(`pm_styles_${op.id}`) || null,
  };
}

export async function saveOperation({ opPath, tree, styles, metaUpdates }) {
  if (IS_TAURI) {
    return await invoke('save_operation', {
      opPath,
      tree,
      styles,
      metaUpdates: metaUpdates || null,
    });
  }
  // Fallback localStorage
  const ops = LS.keys('pm_op_').map(k => LS.get(k)).filter(Boolean);
  const op = ops.find(o => o.path === opPath);
  if (op) {
    op.updated_at = new Date().toISOString();
    if (metaUpdates) Object.assign(op, metaUpdates);
    LS.set(`pm_op_${op.id}`, op);
    LS.set(`pm_tree_${op.id}`, tree);
    LS.set(`pm_styles_${op.id}`, styles);
  }
}

export async function deleteOperation(opPath) {
  if (IS_TAURI) return await invoke('delete_operation', { opPath });
  const ops = LS.keys('pm_op_').map(k => LS.get(k)).filter(Boolean);
  const op = ops.find(o => o.path === opPath);
  if (op) {
    localStorage.removeItem(`pm_op_${op.id}`);
    localStorage.removeItem(`pm_tree_${op.id}`);
    localStorage.removeItem(`pm_styles_${op.id}`);
  }
}

// ── Base de données catalogue ─────────────────────────────────────────────────

export async function loadDatabase(databasePath) {
  if (!databasePath) return [];
  if (IS_TAURI) return await invoke('load_database', { databasePath });
  return LS.get('pm_database') || [];
}

export async function saveDatabase(databasePath, data) {
  if (IS_TAURI) return await invoke('save_database', { databasePath, data });
  LS.set('pm_database', data);
}

// ── Auto-save ─────────────────────────────────────────────────────────────────

let autoSaveTimer = null;

export function scheduleAutoSave(fn, delayMs = 2000) {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(fn, delayMs);
}

export function cancelAutoSave() {
  clearTimeout(autoSaveTimer);
}
