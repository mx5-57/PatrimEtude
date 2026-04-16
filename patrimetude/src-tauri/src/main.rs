#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use std::sync::Mutex;

// ── État global de l'application ──────────────────────────────────────────────

#[derive(Default)]
struct AppState {
    settings: Mutex<Settings>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
struct Settings {
    workspace_path: Option<String>,
    database_path: Option<String>,
    last_opened: Option<String>,
}

// ── Types de données ──────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
struct Operation {
    id: String,
    name: String,
    client: String,
    reference: String,
    created_at: String,
    updated_at: String,
    path: String,
}

#[derive(Serialize, Deserialize)]
struct OperationData {
    meta: OperationMeta,
    tree: serde_json::Value,
    database: serde_json::Value,
    styles: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
struct OperationMeta {
    id: String,
    name: String,
    client: String,
    reference: String,
    created_at: String,
    updated_at: String,
}

// ── Commandes Tauri ───────────────────────────────────────────────────────────

/// Lire les paramètres depuis AppData
#[tauri::command]
fn load_settings(app_handle: tauri::AppHandle) -> Result<Settings, String> {
    let config_path = get_config_path(&app_handle)?;
    if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Erreur lecture paramètres : {}", e))?;
        let settings: Settings = serde_json::from_str(&content)
            .map_err(|e| format!("Erreur parsing paramètres : {}", e))?;
        Ok(settings)
    } else {
        Ok(Settings::default())
    }
}

/// Sauvegarder les paramètres
#[tauri::command]
fn save_settings(app_handle: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let config_path = get_config_path(&app_handle)?;
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Erreur création répertoire : {}", e))?;
    }
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Erreur sérialisation : {}", e))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("Erreur écriture paramètres : {}", e))?;
    Ok(())
}

/// Lister toutes les opérations dans le dossier de travail
#[tauri::command]
fn list_operations(workspace_path: String) -> Result<Vec<Operation>, String> {
    let path = Path::new(&workspace_path);
    if !path.exists() {
        return Ok(vec![]);
    }
    let mut operations = Vec::new();
    let entries = fs::read_dir(path)
        .map_err(|e| format!("Erreur lecture dossier : {}", e))?;
    for entry in entries.flatten() {
        let entry_path = entry.path();
        if entry_path.is_dir() {
            let meta_path = entry_path.join("meta.json");
            if meta_path.exists() {
                if let Ok(content) = fs::read_to_string(&meta_path) {
                    if let Ok(meta) = serde_json::from_str::<OperationMeta>(&content) {
                        operations.push(Operation {
                            id: meta.id.clone(),
                            name: meta.name.clone(),
                            client: meta.client.clone(),
                            reference: meta.reference.clone(),
                            created_at: meta.created_at.clone(),
                            updated_at: meta.updated_at.clone(),
                            path: entry_path.to_string_lossy().to_string(),
                        });
                    }
                }
            }
        }
    }
    // Trier par date de modification décroissante
    operations.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(operations)
}

/// Créer une nouvelle opération
#[tauri::command]
fn create_operation(
    workspace_path: String,
    name: String,
    client: String,
    reference: String,
) -> Result<Operation, String> {
    let id = generate_id();
    let now = current_timestamp();
    // Nom de dossier : référence + nom nettoyé
    let folder_name = sanitize_folder_name(&format!("{}_{}", reference, name));
    let op_path = Path::new(&workspace_path).join(&folder_name);
    fs::create_dir_all(&op_path)
        .map_err(|e| format!("Erreur création dossier opération : {}", e))?;
    let meta = OperationMeta {
        id: id.clone(),
        name: name.clone(),
        client: client.clone(),
        reference: reference.clone(),
        created_at: now.clone(),
        updated_at: now.clone(),
    };
    // Écrire meta.json
    let meta_content = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Erreur sérialisation meta : {}", e))?;
    fs::write(op_path.join("meta.json"), meta_content)
        .map_err(|e| format!("Erreur écriture meta : {}", e))?;
    // Écrire dossier.json vide (arbre initial)
    let empty_tree = serde_json::json!([]);
    fs::write(
        op_path.join("dossier.json"),
        serde_json::to_string_pretty(&empty_tree).unwrap(),
    ).map_err(|e| format!("Erreur écriture dossier : {}", e))?;
    // Écrire styles.json par défaut
    let default_styles = default_styles_json();
    fs::write(
        op_path.join("styles.json"),
        serde_json::to_string_pretty(&default_styles).unwrap(),
    ).map_err(|e| format!("Erreur écriture styles : {}", e))?;
    Ok(Operation {
        id,
        name,
        client,
        reference,
        created_at: meta.created_at,
        updated_at: meta.updated_at,
        path: op_path.to_string_lossy().to_string(),
    })
}

/// Charger une opération complète
#[tauri::command]
fn load_operation(op_path: String) -> Result<serde_json::Value, String> {
    let path = Path::new(&op_path);
    let meta_content = fs::read_to_string(path.join("meta.json"))
        .map_err(|e| format!("Erreur lecture meta : {}", e))?;
    let meta: serde_json::Value = serde_json::from_str(&meta_content)
        .map_err(|e| format!("Erreur parsing meta : {}", e))?;
    let tree = read_json_file(path.join("dossier.json"))
        .unwrap_or_else(|_| serde_json::json!([]));
    let styles = read_json_file(path.join("styles.json"))
        .unwrap_or_else(|_| default_styles_json());
    Ok(serde_json::json!({
        "meta": meta,
        "tree": tree,
        "styles": styles,
    }))
}

/// Sauvegarder une opération
#[tauri::command]
fn save_operation(
    op_path: String,
    tree: serde_json::Value,
    styles: serde_json::Value,
    meta_updates: Option<serde_json::Value>,
) -> Result<(), String> {
    let path = Path::new(&op_path);
    // Mettre à jour updated_at dans meta
    let meta_path = path.join("meta.json");
    if meta_path.exists() {
        let content = fs::read_to_string(&meta_path)
            .map_err(|e| format!("Erreur lecture meta : {}", e))?;
        let mut meta: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Erreur parsing meta : {}", e))?;
        meta["updated_at"] = serde_json::Value::String(current_timestamp());
        if let Some(updates) = meta_updates {
            if let Some(obj) = updates.as_object() {
                for (k, v) in obj {
                    meta[k] = v.clone();
                }
            }
        }
        fs::write(&meta_path, serde_json::to_string_pretty(&meta).unwrap())
            .map_err(|e| format!("Erreur écriture meta : {}", e))?;
    }
    // Sauvegarder l'arbre
    fs::write(
        path.join("dossier.json"),
        serde_json::to_string_pretty(&tree).unwrap(),
    ).map_err(|e| format!("Erreur écriture dossier : {}", e))?;
    // Sauvegarder les styles
    fs::write(
        path.join("styles.json"),
        serde_json::to_string_pretty(&styles).unwrap(),
    ).map_err(|e| format!("Erreur écriture styles : {}", e))?;
    Ok(())
}

/// Supprimer une opération
#[tauri::command]
fn delete_operation(op_path: String) -> Result<(), String> {
    let path = Path::new(&op_path);
    if path.exists() {
        fs::remove_dir_all(path)
            .map_err(|e| format!("Erreur suppression opération : {}", e))?;
    }
    Ok(())
}

/// Charger la base de données catalogue
#[tauri::command]
fn load_database(database_path: String) -> Result<serde_json::Value, String> {
    let path = Path::new(&database_path).join("catalogue.json");
    if path.exists() {
        read_json_file(path)
    } else {
        Ok(serde_json::json!([]))
    }
}

/// Sauvegarder la base de données catalogue
#[tauri::command]
fn save_database(database_path: String, data: serde_json::Value) -> Result<(), String> {
    let dir = Path::new(&database_path);
    fs::create_dir_all(dir).map_err(|e| format!("Erreur création répertoire BDD : {}", e))?;
    fs::write(
        dir.join("catalogue.json"),
        serde_json::to_string_pretty(&data).unwrap(),
    ).map_err(|e| format!("Erreur écriture catalogue : {}", e))?;
    Ok(())
}

/// Ouvrir un dialog de sélection de dossier
#[tauri::command]
async fn pick_folder(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    // Utilise l'API dialog de Tauri via le frontend — cette commande est un wrapper
    // Le vrai dialog se déclenche depuis le JS avec @tauri-apps/api/dialog
    Ok(None)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn get_config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path_resolver()
        .app_config_dir()
        .ok_or("Impossible de résoudre AppConfig")?;
    Ok(app_dir.join("settings.json"))
}

fn read_json_file(path: impl AsRef<Path>) -> Result<serde_json::Value, String> {
    let content = fs::read_to_string(path.as_ref())
        .map_err(|e| format!("Erreur lecture fichier : {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Erreur parsing JSON : {}", e))
}

fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{:x}{:04x}", t.as_secs(), t.subsec_millis())
}

fn current_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    // Format ISO simplifié — en production, utiliser chrono
    let secs = t.as_secs();
    let days = secs / 86400;
    let year = 1970 + days / 365;
    format!("{}-01-01T00:00:00Z", year) // Simplifié — remplacer par chrono::Local::now()
}

fn sanitize_folder_name(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' => c,
            ' ' => '_',
            _ => '-',
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn default_styles_json() -> serde_json::Value {
    serde_json::json!({
        "lot":     {"font":"Sans-serif","size":15,"weight":"bold","italic":false,"underline":false,"color":"#0C447C","bg":"transparent","lineH":1.4,"spB":24,"spA":8,"bl":false,"blc":"#0C447C","blw":3},
        "chap":    {"font":"Sans-serif","size":13,"weight":"bold","italic":false,"underline":false,"color":"#085041","bg":"transparent","lineH":1.4,"spB":18,"spA":4,"bl":false,"blc":"#1D9E75","blw":2},
        "subchap": {"font":"Sans-serif","size":12,"weight":"bold","italic":false,"underline":false,"color":"#633806","bg":"transparent","lineH":1.4,"spB":14,"spA":3,"bl":false,"blc":"#BA7517","blw":2},
        "ouvrage": {"font":"Sans-serif","size":11,"weight":"normal","italic":false,"underline":false,"color":"#444441","bg":"#F1EFE8","lineH":1.4,"spB":16,"spA":6,"bl":true,"blc":"#888780","blw":3},
        "body":    {"font":"Sans-serif","size":13,"weight":"normal","italic":false,"underline":false,"color":"#1a1a1a","bg":"transparent","lineH":1.75,"spB":0,"spA":8,"bl":false,"blc":"#888780","blw":1},
        "t1":      {"font":"Sans-serif","size":15,"weight":"bold","italic":false,"underline":false,"color":"#1a1a1a","bg":"transparent","lineH":1.4,"spB":12,"spA":6,"bl":false,"blc":"#888780","blw":1},
        "t2":      {"font":"Sans-serif","size":13,"weight":"bold","italic":false,"underline":false,"color":"#1a1a1a","bg":"transparent","lineH":1.4,"spB":8,"spA":4,"bl":false,"blc":"#888780","blw":1},
        "list":    {"font":"Sans-serif","size":13,"weight":"normal","italic":false,"underline":false,"color":"#1a1a1a","bg":"transparent","lineH":1.6,"spB":0,"spA":4,"bl":false,"blc":"#888780","blw":1},
        "quote":   {"font":"Serif","size":12,"weight":"normal","italic":true,"underline":false,"color":"#5F5E5A","bg":"#E6F1FB","lineH":1.7,"spB":6,"spA":6,"bl":true,"blc":"#378ADD","blw":3},
        "note":    {"font":"Sans-serif","size":11,"weight":"normal","italic":false,"underline":false,"color":"#0C447C","bg":"#E6F1FB","lineH":1.6,"spB":4,"spA":4,"bl":true,"blc":"#185FA5","blw":3}
    })
}

// ── Main ──────────────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            list_operations,
            create_operation,
            load_operation,
            save_operation,
            delete_operation,
            load_database,
            save_database,
            pick_folder,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur au démarrage de PatrimÉtude");
}
