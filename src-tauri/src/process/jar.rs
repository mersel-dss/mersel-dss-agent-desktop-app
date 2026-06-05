//! Jar dosyası çözümleme: bir servis dizinindeki en güncel eşleşen jar'ı bulur.

use crate::config::ServiceDescriptor;
use std::path::{Path, PathBuf};

/// Verilen dizinde `<jar_prefix>*.jar` desenine uyan en yeni jar'ı döner.
pub fn resolve_jar(dir: &Path, descriptor: &ServiceDescriptor) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    let mut candidates: Vec<(std::time::SystemTime, PathBuf)> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| is_matching_jar(p, descriptor.jar_prefix))
        .filter_map(|p| {
            let modified = p.metadata().ok()?.modified().ok()?;
            Some((modified, p))
        })
        .collect();

    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    candidates.into_iter().next().map(|(_, p)| p)
}

fn is_matching_jar(path: &Path, prefix: &str) -> bool {
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };
    name.starts_with(prefix) && name.ends_with(".jar")
}
