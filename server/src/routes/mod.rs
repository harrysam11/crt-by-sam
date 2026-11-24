use axum::{
    extract::{OriginalUri, Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Json, Response},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use std::time::Instant;
use uuid::Uuid;

use crate::auth::{
    create_token, hash_password, verify_password, verify_token, AuthResponse, LoginRequest,
    RegisterRequest, SyncWorkspaceRequest, SyncWorkspaceResponse, UserPublic,
};
use crate::db::{DbPool, User};

use crate::rate_limit::{rate_limit_auth_middleware, rate_limit_proxy_middleware};

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub engine: &'static str,
    pub version: &'static str,
    pub uptime_secs: u64,
}

pub struct AppState {
    pub start_time: Instant,
    pub client: reqwest::Client,
    pub db: DbPool,
}

#[derive(Deserialize)]
pub struct YahooParams {
    pub symbol: Option<String>,
    pub range: Option<String>,
    pub interval: Option<String>,
}

pub fn router() -> Router<Arc<AppState>> {
    let auth_routes = Router::new()
        .route("/register", post(register_handler))
        .route("/login", post(login_handler))
        .layer(axum::middleware::from_fn(rate_limit_auth_middleware));

    let proxy_routes = Router::new()
        .route("/yahoo", get(yahoo_handler))
        .route("/yahoo/*path", get(yahoo_handler))
        .route("/calendar", get(calendar_handler))
        .route("/calendar/*path", get(calendar_handler))
        .route("/binance", get(binance_handler))
        .route("/binance/*path", get(binance_handler))
        .layer(axum::middleware::from_fn(rate_limit_proxy_middleware));

    Router::new()
        .route("/health", get(health_handler))
        .nest("/auth", auth_routes)
        .route("/auth/me", get(me_handler))
        .route("/user/sync", post(sync_save_handler).get(sync_load_handler))
        .merge(proxy_routes)
}


async fn health_handler(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        engine: "TerminalX Rust High-Performance Engine (Tokio/Axum)",
        version: "2.0.0",
        uptime_secs: state.start_time.elapsed().as_secs(),
    })
}

fn extract_bearer_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|auth| {
            if auth.starts_with("Bearer ") {
                Some(auth[7..].trim().to_string())
            } else {
                None
            }
        })
}

async fn register_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> Response {
    let email = req.email.trim().to_lowercase();
    let username = req.username.trim();

    // 1. Validation
    if email.is_empty() || !email.contains('@') || !email.contains('.') {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "A valid email address is required." })),
        )
            .into_response();
    }

    if username.len() < 3 || username.len() > 32 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Username must be between 3 and 32 characters." })),
        )
            .into_response();
    }

    if req.password.len() < 6 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Password must be at least 6 characters long." })),
        )
            .into_response();
    }

    // 2. Check if user already exists
    match state.db.find_user_by_email_or_username(&email).await {
        Ok(Some(_)) => {
            return (
                StatusCode::CONFLICT,
                Json(json!({ "error": "An account with this email already exists." })),
            )
                .into_response();
        }
        Ok(None) => {}
        Err(e) => {
            tracing::error!("Database query error during registration: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Internal database error occurred." })),
            )
                .into_response();
        }
    }

    match state.db.find_user_by_email_or_username(username).await {
        Ok(Some(_)) => {
            return (
                StatusCode::CONFLICT,
                Json(json!({ "error": "This username is already taken. Please choose another." })),
            )
                .into_response();
        }
        Ok(None) => {}
        Err(e) => {
            tracing::error!("Database query error during username check: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Internal database error occurred." })),
            )
                .into_response();
        }
    }

    // 3. Hash password with Argon2id
    let password_hash = match hash_password(&req.password) {
        Ok(h) => h,
        Err(e) => {
            tracing::error!("Argon2 hashing failure: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to securely process credentials." })),
            )
                .into_response();
        }
    };

    let now = chrono::Utc::now().timestamp();
    let user_id = Uuid::new_v4().to_string();

    let user = User {
        id: user_id.clone(),
        email: email.clone(),
        username: username.to_string(),
        password_hash,
        created_at: now,
        updated_at: now,
    };

    if let Err(e) = state.db.create_user(&user).await {
        tracing::error!("Failed to create user in database: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Could not register user account." })),
        )
            .into_response();
    }

    // 4. Generate JWT Token
    let token = match create_token(&user.id, &user.email, &user.username) {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("JWT generation error: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to create authentication session." })),
            )
                .into_response();
        }
    };

    (
        StatusCode::CREATED,
        Json(AuthResponse {
            token,
            user: UserPublic {
                id: user.id,
                email: user.email,
                username: user.username,
                created_at: user.created_at,
            },
        }),
    )
        .into_response()
}

async fn login_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> Response {
    let identifier = req.identifier.trim();
    if identifier.is_empty() || req.password.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Username/Email and Password are required." })),
        )
            .into_response();
    }

    let user_opt = match state.db.find_user_by_email_or_username(identifier).await {
        Ok(u) => u,
        Err(e) => {
            tracing::error!("Database query error during login: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Internal database error occurred." })),
            )
                .into_response();
        }
    };

    let user = match user_opt {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Invalid email/username or password." })),
            )
                .into_response();
        }
    };

    if !verify_password(&user.password_hash, &req.password) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Invalid email/username or password." })),
        )
            .into_response();
    }

    let token = match create_token(&user.id, &user.email, &user.username) {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("JWT generation error: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to create authentication session." })),
            )
                .into_response();
        }
    };

    (
        StatusCode::OK,
        Json(AuthResponse {
            token,
            user: UserPublic {
                id: user.id,
                email: user.email,
                username: user.username,
                created_at: user.created_at,
            },
        }),
    )
        .into_response()
}

async fn me_handler(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
) -> Response {
    let token = match extract_bearer_token(&headers) {
        Some(t) => t,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Missing or malformed Authorization header." })),
            )
                .into_response();
        }
    };

    let claims = match verify_token(&token) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Session token has expired or is invalid." })),
            )
                .into_response();
        }
    };

    match state.db.find_user_by_id(&claims.sub).await {
        Ok(Some(user)) => (
            StatusCode::OK,
            Json(UserPublic {
                id: user.id,
                email: user.email,
                username: user.username,
                created_at: user.created_at,
            }),
        )
            .into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "User account no longer exists." })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Database error fetching user: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to load user profile." })),
            )
                .into_response()
        }
    }
}

async fn sync_save_handler(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SyncWorkspaceRequest>,
) -> Response {
    let token = match extract_bearer_token(&headers) {
        Some(t) => t,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Authentication required to sync workspace." })),
            )
                .into_response();
        }
    };

    let claims = match verify_token(&token) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Session token expired." })),
            )
                .into_response();
        }
    };

    let data_str = payload.data.to_string();
    let now = chrono::Utc::now().timestamp();

    match state.db.save_workspace(&claims.sub, &data_str, now).await {
        Ok(()) => (
            StatusCode::OK,
            Json(SyncWorkspaceResponse {
                status: "saved",
                updated_at: now,
                data: Some(payload.data),
            }),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to persist workspace: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to save workspace state to database." })),
            )
                .into_response()
        }
    }
}

async fn sync_load_handler(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
) -> Response {
    let token = match extract_bearer_token(&headers) {
        Some(t) => t,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Authentication required to load workspace." })),
            )
                .into_response();
        }
    };

    let claims = match verify_token(&token) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Session token expired." })),
            )
                .into_response();
        }
    };

    match state.db.load_workspace(&claims.sub).await {
        Ok(Some(data_str)) => {
            let data_json: serde_json::Value = serde_json::from_str(&data_str).unwrap_or(serde_json::Value::Null);
            (
                StatusCode::OK,
                Json(SyncWorkspaceResponse {
                    status: "loaded",
                    updated_at: chrono::Utc::now().timestamp(),
                    data: Some(data_json),
                }),
            )
                .into_response()
        }
        Ok(None) => (
            StatusCode::OK,
            Json(SyncWorkspaceResponse {
                status: "empty",
                updated_at: 0,
                data: None,
            }),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("Failed to load workspace: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to load workspace state from database." })),
            )
                .into_response()
        }
    }
}

fn is_safe_subpath(path: &str) -> bool {
    !path.contains("..") && !path.contains('\0') && !path.contains('\\')
}

async fn yahoo_handler(
    OriginalUri(uri): OriginalUri,
    Query(params): Query<YahooParams>,
    State(state): State<Arc<AppState>>,
) -> Response {
    let full_path = uri.path();
    let subpath = full_path.strip_prefix("/api/yahoo").unwrap_or(full_path);

    if !is_safe_subpath(subpath) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid or unsafe path characters detected" })),
        )
            .into_response();
    }

    let yahoo_url = if !subpath.is_empty() && subpath != "/" {
        let query_str = uri.query().map(|q| format!("?{}", q)).unwrap_or_default();
        format!("https://query1.finance.yahoo.com{}{}", subpath, query_str)
    } else if let Some(ref s) = params.symbol {
        let range = params.range.as_deref().unwrap_or("1mo");
        let interval = params.interval.as_deref().unwrap_or("1d");
        format!(
            "https://query1.finance.yahoo.com/v8/finance/chart/{}?range={}&interval={}&includePrePost=true&events=div%7Csplit",
            urlencoding::encode(s),
            range,
            interval
        )
    } else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "symbol query parameter or subpath required" })),
        )
            .into_response();
    };

    match state
        .client
        .get(&yahoo_url)
        .header(
            header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        )
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status();
            match resp.bytes().await {
                Ok(bytes) => {
                    let mut headers = HeaderMap::new();
                    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
                    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=15"));
                    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
                    (status, headers, bytes).into_response()
                }
                Err(err) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("Failed to read Yahoo body: {}", err) })),
                )
                    .into_response(),
            }
        }
        Err(err) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": format!("Yahoo upstream error: {}", err) })),
        )
            .into_response(),
    }
}

async fn calendar_handler(
    OriginalUri(uri): OriginalUri,
    State(state): State<Arc<AppState>>,
) -> Response {
    let full_path = uri.path();
    let subpath = full_path.strip_prefix("/api/calendar").unwrap_or(full_path);

    if !is_safe_subpath(subpath) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid or unsafe path characters detected" })),
        )
            .into_response();
    }

    let target_subpath = if subpath.is_empty() || subpath == "/" {
        "/ff_calendar_thisweek.json"
    } else {
        subpath
    };

    let query_str = uri.query().map(|q| format!("?{}", q)).unwrap_or_default();
    let calendar_url = format!("https://nfs.faireconomy.media{}{}", target_subpath, query_str);

    match state
        .client
        .get(&calendar_url)
        .header(header::USER_AGENT, "TerminalX-Terminal/2.0")
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status();
            match resp.bytes().await {
                Ok(bytes) => {
                    let mut headers = HeaderMap::new();
                    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
                    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=60"));
                    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
                    (status, headers, bytes).into_response()
                }
                Err(err) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("Failed to read Calendar body: {}", err) })),
                )
                    .into_response(),
            }
        }
        Err(err) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": format!("Calendar upstream error: {}", err) })),
        )
            .into_response(),
    }
}

async fn binance_handler(
    OriginalUri(uri): OriginalUri,
    State(state): State<Arc<AppState>>,
) -> Response {
    let full_path = uri.path();
    let subpath = full_path.strip_prefix("/api/binance").unwrap_or(full_path);

    if !is_safe_subpath(subpath) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid or unsafe path characters detected" })),
        )
            .into_response();
    }

    let target_subpath = if subpath.starts_with("/api/v3") {
        subpath.to_string()
    } else {
        format!("/api/v3{}", subpath)
    };
    let query_str = uri.query().map(|q| format!("?{}", q)).unwrap_or_default();
    let binance_url = format!("https://api.binance.com{}{}", target_subpath, query_str);

    match state
        .client
        .get(&binance_url)
        .header(
            header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        )
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status();
            match resp.bytes().await {
                Ok(bytes) => {
                    let mut headers = HeaderMap::new();
                    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
                    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=1"));
                    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
                    (status, headers, bytes).into_response()
                }
                Err(err) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("Failed to read Binance body: {}", err) })),
                )
                    .into_response(),
            }
        }
        Err(err) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": format!("Binance upstream error: {}", err) })),
        )
            .into_response(),
    }
}
