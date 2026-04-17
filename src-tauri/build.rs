fn main() {
  if let Err(e) = tauri_build::try_build(tauri_build::Attributes::new()) {
    println!("cargo:warning=tauri-build warning: {}", e);
  }
}
