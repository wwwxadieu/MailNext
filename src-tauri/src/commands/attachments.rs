//! Saves a decoded email attachment to an arbitrary path on disk — the path
//! comes from a native "Save As" dialog on the frontend, this command only
//! handles the base64 -> raw bytes decode and the actual file write.

use std::fs;

#[tauri::command]
pub fn save_attachment_file(path: String, content_base64: String) -> Result<(), String> {
    let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, content_base64.trim())
        .map_err(|e| format!("Invalid attachment data: {e}"))?;
    fs::write(&path, bytes).map_err(|e| e.to_string())
}
