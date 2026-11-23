use axum::{
    extract::Query,
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
        .route("/calendar", get(calendar_handler))
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

async fn yahoo_handler(
    Query(params): Query<YahooParams>,
    axum::extract::State(state): axum::extract::State<std::sync::Arc<AppState>>,
) -> Response {
    let symbol = match params.symbol {
        Some(s) if !s.trim().is_empty() => s,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "symbol query parameter required" })),
            )
                .into_response()
        }
    };

    let range = params.range.unwrap_or_else(|| "1mo".to_string());
    let interval = params.interval.unwrap_or_else(|| "1d".to_string());

    let yahoo_url = format!(
        "https://query1.finance.yahoo.com/v8/finance/chart/{}?range={}&interval={}&includePrePost=true&events=div%7Csplit",
        urlencoding::encode(&symbol),
        range,
        interval
    );

    match state
        .client
        .get(&yahoo_url)
        .header(
            header::USER_AGENT,
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
                    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=10"));
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
    axum::extract::State(state): axum::extract::State<std::sync::Arc<AppState>>,
) -> Response {
    let calendar_url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

    match state
        .client
        .get(calendar_url)
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
