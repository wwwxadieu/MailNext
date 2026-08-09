//! Local, algorithmic email summarization — no network call, no API key,
//! no third-party AI service. Extractive: scores each sentence by the
//! frequency of its non-stopword words within the message (subject-line
//! words count extra, since they're a decent proxy for what the email is
//! actually about) and returns the highest-scoring sentences, restored to
//! their original order so the summary still reads coherently.

use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

const MAX_INPUT_CHARS: usize = 20_000;
const MIN_SENTENCE_WORDS: usize = 4;
const TARGET_SUMMARY_SENTENCES: usize = 3;

#[tauri::command]
pub fn summarize_email(subject: String, body: String) -> Result<String, String> {
    let body = body.trim();
    if body.is_empty() {
        return Err("This message has no readable content to summarize.".into());
    }

    let truncated: String = body.chars().take(MAX_INPUT_CHARS).collect();
    let sentences = split_sentences(&truncated);
    let candidates: Vec<&str> = sentences
        .iter()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && !looks_like_boilerplate(s) && word_count(s) >= MIN_SENTENCE_WORDS)
        .collect();

    if candidates.is_empty() {
        // Too short or unstructured to extract from meaningfully — hand
        // back a trimmed version of the original instead of failing.
        return Ok(truncate_chars(body, 400));
    }

    if candidates.len() <= TARGET_SUMMARY_SENTENCES {
        return Ok(candidates.join(" "));
    }

    let frequencies = word_frequencies(&candidates, &subject);
    let mut scored: Vec<(usize, &str, f64)> = candidates
        .iter()
        .enumerate()
        .map(|(i, &s)| (i, s, score_sentence(s, &frequencies)))
        .collect();
    scored.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));

    let mut top: Vec<(usize, &str)> = scored
        .into_iter()
        .take(TARGET_SUMMARY_SENTENCES)
        .map(|(i, s, _)| (i, s))
        .collect();
    top.sort_by_key(|(i, _)| *i);

    Ok(top.into_iter().map(|(_, s)| s).collect::<Vec<_>>().join(" "))
}

fn split_sentences(text: &str) -> Vec<String> {
    let mut sentences = Vec::new();
    let mut current = String::new();
    let chars: Vec<char> = text.chars().collect();

    for i in 0..chars.len() {
        let c = chars[i];
        current.push(c);
        if c == '.' || c == '!' || c == '?' {
            // Don't split mid-abbreviation ("e.g.", "Dr.") — a lowercase
            // letter immediately after means it's probably not a real
            // sentence boundary.
            let next_is_lower = chars.get(i + 1).map(|c| c.is_lowercase()).unwrap_or(false);
            if !next_is_lower {
                sentences.push(current.trim().to_string());
                current.clear();
            }
        } else if c == '\n' && chars.get(i + 1) == Some(&'\n') {
            sentences.push(current.trim().to_string());
            current.clear();
        }
    }
    if !current.trim().is_empty() {
        sentences.push(current.trim().to_string());
    }
    sentences
}

fn looks_like_boilerplate(sentence: &str) -> bool {
    let lower = sentence.to_lowercase();
    sentence.starts_with('>')
        || (lower.starts_with("on ") && lower.contains("wrote:"))
        || lower.contains("unsubscribe")
        || lower.contains("privacy policy")
        || lower.contains("view this email in your browser")
        || lower.starts_with("sent from my")
}

fn word_count(sentence: &str) -> usize {
    sentence.split_whitespace().count()
}

fn tokenize(text: &str) -> Vec<String> {
    text.split_whitespace()
        .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase())
        .filter(|w| !w.is_empty())
        .collect()
}

fn stopwords() -> &'static HashSet<&'static str> {
    static WORDS: OnceLock<HashSet<&'static str>> = OnceLock::new();
    WORDS.get_or_init(|| {
        [
            // English
            "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been",
            "being", "to", "of", "in", "on", "at", "for", "with", "as", "by", "that", "this",
            "these", "those", "it", "its", "from", "have", "has", "had", "not", "will", "would",
            "can", "could", "should", "you", "your", "we", "our", "i", "he", "she", "they",
            "them", "his", "her", "their", "if", "so", "than", "then", "there", "here", "which",
            "who", "whom", "what", "when", "where", "how", "do", "does", "did", "just", "also",
            "about", "into", "up", "out", "over", "under", "again", "further", "more", "most",
            "other", "some", "such", "no", "nor", "only", "own", "same", "too", "very", "s", "t",
            "don", "now", "re", "hi", "hello", "thanks", "regards",
            // Vietnamese
            "là", "của", "và", "có", "được", "cho", "này", "đó", "các", "một", "những", "với",
            "để", "khi", "đã", "sẽ", "không", "cũng", "như", "vào", "ra", "trên", "dưới", "theo",
            "về", "tại", "nếu", "thì", "nên", "hay", "hoặc", "mà", "nhưng", "vì", "do", "bởi",
            "từ", "đến", "rồi", "còn", "lại", "nữa", "rất", "quá", "chỉ", "đang", "phải", "bạn",
            "tôi", "chúng", "họ", "anh", "chị", "em",
        ]
        .into_iter()
        .collect()
    })
}

fn word_frequencies(sentences: &[&str], subject: &str) -> HashMap<String, u32> {
    let mut freq: HashMap<String, u32> = HashMap::new();
    for sentence in sentences {
        for word in tokenize(sentence) {
            if word.len() < 2 || stopwords().contains(word.as_str()) {
                continue;
            }
            *freq.entry(word).or_insert(0) += 1;
        }
    }
    // Words that also appear in the subject line are a decent proxy for
    // what the email is actually about — weight them up a little so
    // sentences echoing the subject rank higher.
    for word in tokenize(subject) {
        if let Some(count) = freq.get_mut(&word) {
            *count += 2;
        }
    }
    freq
}

fn score_sentence(sentence: &str, frequencies: &HashMap<String, u32>) -> f64 {
    let words = tokenize(sentence);
    if words.is_empty() {
        return 0.0;
    }
    let total: f64 = words.iter().map(|w| *frequencies.get(w).unwrap_or(&0) as f64).sum();
    // Normalize by sqrt(length) rather than length so longer, genuinely
    // content-rich sentences aren't penalized as heavily as a straight
    // per-word average would, while still discouraging run-on sentences
    // from winning purely on word count.
    total / (words.len() as f64).sqrt()
}

fn truncate_chars(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    let truncated: String = s.chars().take(max).collect();
    format!("{truncated}…")
}

#[cfg(test)]
mod tests {
    use super::summarize_email;

    #[test]
    fn summarizes_a_multi_sentence_email() {
        let body = "Hi team. The Q3 budget review is scheduled for next Tuesday at 10am. \
                     Please bring your department's spending report. We will also discuss \
                     the new hiring plan for Q4. Let me know if that time doesn't work for you. \
                     Thanks, Jordan.";
        let summary = summarize_email("Q3 Budget Review".into(), body.into()).unwrap();
        assert!(!summary.is_empty());
        assert!(summary.contains("budget") || summary.contains("Budget"));
    }

    #[test]
    fn rejects_empty_body() {
        assert!(summarize_email("Subject".into(), "   ".into()).is_err());
    }

    #[test]
    fn returns_short_body_unchanged() {
        let body = "See you at 3pm.";
        let summary = summarize_email("Meeting".into(), body.into()).unwrap();
        assert_eq!(summary, body);
    }
}
