fn main() {
  // Utilise try_build pour eviter l'echec si les icones sont absentes
  if let Err(e) = tauri_build::try_build(tauri_build::Attributes::new()) {
    println!("cargo:warning=tauri-build warning: {}", e);
  }
}
