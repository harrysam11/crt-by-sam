use axum::{
    extract::{OriginalUri, Query},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Json, Response},
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::time::Instant;

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
}

#[derive(Deserialize)]
pub struct YahooParams {
    pub symbol: Option<String>,
    pub range: Option<String>,
    pub interval: Option<String>,
}

pub fn router() -> Router<std::sync::Arc<AppState>> {
    Router::new()
        .route("/health", get(health_handler))
        .route("/yahoo", get(yahoo_handler))
        .route("/yahoo/*path", get(yahoo_handler))
        .route("/calendar", get(calendar_handler))
        .route("/calendar/*path", get(calendar_handler))
        .route("/binance", get(binance_handler))
        .route("/binance/*path", get(binance_handler))
}

async fn health_handler(
    axum::extract::State(state): axum::extract::State<std::sync::Arc<AppState>>,
) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        engine: "CRT Rust High-Performance Engine (Tokio/Axum)",
        version: "2.0.0",
        uptime_secs: state.start_time.elapsed().as_secs(),
    })
}

fn is_safe_subpath(path: &str) -> bool {
    !path.contains("..") && !path.contains('\0') && !path.contains('\\')
}

async fn yahoo_handler(
    OriginalUri(uri): OriginalUri,
    Query(params): Query<YahooParams>,
    axum::extract::State(state): axum::extract::State<std::sync::Arc<AppState>>,
) -> Response {
    let full_path = uri.path();
    let subpath = full_path.strip_prefix("/api/yahoo").unwrap_or(full_path);

    if !is_safe_subpath(subpath) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid or unsafe path characters detected" })),
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
            Json(serde_json::json!({ "error": "symbol query parameter or subpath required" })),
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
                    Json(serde_json::json!({ "error": format!("Failed to read Yahoo body: {}", err) })),
                )
                    .into_response(),
            }
        }
        Err(err) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": format!("Yahoo upstream error: {}", err) })),
        )
            .into_response(),
    }
}

async fn calendar_handler(
    OriginalUri(uri): OriginalUri,
    axum::extract::State(state): axum::extract::State<std::sync::Arc<AppState>>,
) -> Response {
    let full_path = uri.path();
    let subpath = full_path.strip_prefix("/api/calendar").unwrap_or(full_path);

    if !is_safe_subpath(subpath) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid or unsafe path characters detected" })),
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
        .header(header::USER_AGENT, "CRT-Terminal/2.0")
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
                    Json(serde_json::json!({ "error": format!("Failed to read Calendar body: {}", err) })),
                )
                    .into_response(),
            }
        }
        Err(err) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": format!("Calendar upstream error: {}", err) })),
        )
            .into_response(),
    }
}

async fn binance_handler(
    OriginalUri(uri): OriginalUri,
    axum::extract::State(state): axum::extract::State<std::sync::Arc<AppState>>,
) -> Response {
    let full_path = uri.path();
    let subpath = full_path.strip_prefix("/api/binance").unwrap_or(full_path);

    if !is_safe_subpath(subpath) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid or unsafe path characters detected" })),
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
                    Json(serde_json::json!({ "error": format!("Failed to read Binance body: {}", err) })),
                )
                    .into_response(),
            }
        }
        Err(err) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": format!("Binance upstream error: {}", err) })),
        )
            .into_response(),
    }
}

