use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String, // user_id
    pub email: String,
    pub username: String,
    pub exp: usize,
    pub iat: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserPublic {
    pub id: String,
    pub email: String,
    pub username: String,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub identifier: String, // email or username
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserPublic,
}

#[derive(Debug, Deserialize)]
pub struct SyncWorkspaceRequest {
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct SyncWorkspaceResponse {
    pub status: &'static str,
    pub updated_at: i64,
    pub data: Option<serde_json::Value>,
}

use std::sync::OnceLock;

static JWT_SECRET_CELL: OnceLock<String> = OnceLock::new();

const FORBIDDEN_PLACEHOLDER_SECRETS: &[&str] = &[
    "terminalx_super_secret_jwt_key_2026_institutional_grade",
    "secret",
    "jwt_secret",
    "change_me",
    "password123",
    "default_jwt_secret_do_not_use_in_prod",
];

/// Initializes and validates the JWT signing secret at server startup.
/// Fails startup if missing in production or if below 32 characters.
pub fn init_jwt_secret() -> Result<(), String> {
    if let Ok(val) = env::var("JWT_SECRET") {
        let trimmed = val.trim();
        if trimmed.len() < 32 {
            return Err(format!(
                "JWT_SECRET is insecure (length {}). Must be at least 32 characters for 256-bit cryptographic strength.",
                trimmed.len()
            ));
        }
        for placeholder in FORBIDDEN_PLACEHOLDER_SECRETS {
            if trimmed.eq_ignore_ascii_case(placeholder) {
                return Err(format!(
                    "JWT_SECRET cannot be a known public placeholder ('{}'). Use a secure random string.",
                    placeholder
                ));
            }
        }
        let _ = JWT_SECRET_CELL.set(trimmed.to_string());
        tracing::info!("JWT signing secret successfully configured from environment (length: {}).", trimmed.len());
        Ok(())
    } else {
        let is_prod = env::var("ENVIRONMENT").map(|v| v.to_lowercase() == "production").unwrap_or(false)
            || env::var("RAILWAY_ENVIRONMENT").is_ok();

        if is_prod {
            Err("FATAL SECURITY ERROR: JWT_SECRET environment variable is missing in production environment. A secure 256-bit secret is strictly required.".to_string())
        } else {
            use argon2::password_hash::rand_core::RngCore;
            let mut key = [0u8; 32];
            OsRng.fill_bytes(&mut key);
            let ephemeral_secret: String = key.iter().map(|b| format!("{:02x}", b)).collect();
            tracing::warn!(
                "SECURITY WARNING: JWT_SECRET not found in development environment. Generated an ephemeral in-memory 256-bit cryptographic key. Set JWT_SECRET in production!"
            );
            let _ = JWT_SECRET_CELL.set(ephemeral_secret);
            Ok(())
        }
    }
}

pub fn get_jwt_secret() -> &'static str {
    JWT_SECRET_CELL.get_or_init(|| {
        use argon2::password_hash::rand_core::RngCore;
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);
        key.iter().map(|b| format!("{:02x}", b)).collect()
    })
}

/// Validates username: alphanumeric + underscores/hyphens, 3 to 32 chars
pub fn validate_username(username: &str) -> Result<(), &'static str> {
    let u = username.trim();
    if u.len() < 3 {
        return Err("Username must be at least 3 characters long.");
    }
    if u.len() > 32 {
        return Err("Username cannot exceed 32 characters.");
    }
    if !u.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err("Username may only contain letters, numbers, underscores, and hyphens.");
    }
    Ok(())
}

/// Validates password: 8 to 128 chars (prevents Argon2 memory exhaustion DoS)
pub fn validate_password(password: &str) -> Result<(), &'static str> {
    if password.len() < 8 {
        return Err("Password must be at least 8 characters long.");
    }
    if password.len() > 128 {
        return Err("Password exceeds maximum allowed length of 128 characters.");
    }
    let has_alphabetic = password.chars().any(|c| c.is_alphabetic());
    let has_numeric_or_special = password.chars().any(|c| !c.is_alphabetic());
    if !has_alphabetic || !has_numeric_or_special {
        return Err("Password must contain both letters and numbers or symbols.");
    }
    Ok(())
}

/// Validates email address format and length
pub fn validate_email(email: &str) -> Result<(), &'static str> {
    let e = email.trim();
    if e.len() < 5 || e.len() > 254 {
        return Err("Email address must be between 5 and 254 characters.");
    }
    let parts: Vec<&str> = e.split('@').collect();
    if parts.len() != 2 || parts[0].is_empty() || parts[1].is_empty() {
        return Err("Please provide a valid email address with a valid domain.");
    }
    if !parts[1].contains('.') || parts[1].starts_with('.') || parts[1].ends_with('.') {
        return Err("Please provide a valid email domain.");
    }
    if e.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("Email address cannot contain whitespace or control characters.");
    }
    Ok(())
}

pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

pub fn verify_password(hash: &str, password: &str) -> bool {
    if let Ok(parsed_hash) = PasswordHash::new(hash) {
        Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok()
    } else {
        false
    }
}

pub fn create_token(user_id: &str, email: &str, username: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let secret = get_jwt_secret();
    let now = chrono::Utc::now().timestamp() as usize;
    let exp = now + 14 * 24 * 3600; // 14 days session
    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        username: username.to_string(),
        exp,
        iat: now,
    };
    encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes()))
}

pub fn verify_token(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let secret = get_jwt_secret();
    let mut validation = Validation::default();
    validation.validate_exp = true;
    let data = decode::<Claims>(token, &DecodingKey::from_secret(secret.as_bytes()), &validation)?;
    Ok(data.claims)
}
