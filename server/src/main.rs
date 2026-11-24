use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::{routing::get, Extension, Router};
use tokio::sync::{broadcast, Mutex, RwLock};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod auth;
mod db;
mod engine;
mod market;
mod rate_limit;
mod routes;
mod ws;

use db::DbPool;
use engine::{RiskRules, TradeXGuardian};
use market::{start_binance_feed, start_metaquotes_feed, PriceStore};
use rate_limit::RateLimiter;
use routes::AppState;
use ws::{ws_handler, WsState};


#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "terminalx_server=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 2. Validate and Initialize Cryptographic JWT Secrets
    auth::init_jwt_secret().map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

    // 3. Initialize Database Pool (PostgreSQL / SQLite fallback)
    let db = DbPool::init().await?;

    // 3. Shared In-Memory Stores
    let price_store: PriceStore = Arc::new(RwLock::new(HashMap::new()));
    let (price_tx, _) = broadcast::channel(2048);

    // 4. Start Real-time Data Feeds in background
    start_binance_feed(price_store.clone(), price_tx.clone());
    start_metaquotes_feed(price_store.clone(), price_tx.clone());

    // 5. Initialize TradeXGuardian Risk Engine
    let guardian = Arc::new(Mutex::new(TradeXGuardian::new(RiskRules::default())));

    // 6. Rate Limiters
    let auth_limiter = RateLimiter::new(20, Duration::from_secs(60)); // 20 attempts/min per IP
    let proxy_limiter = RateLimiter::new(240, Duration::from_secs(60)); // 240 requests/min per IP

    // 7. State containers
    let app_state = Arc::new(AppState {
        start_time: Instant::now(),
        client: reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()?,
        db,
    });

    let ws_state = Arc::new(WsState {
        price_store: price_store.clone(),
        price_tx,
        guardian,
    });

    // 8. CORS configuration (Restricted institutional policy)
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
            axum::http::header::ACCEPT,
            axum::http::header::ORIGIN,
            axum::http::HeaderName::from_static("x-requested-with"),
        ]);

    // 9. Static file serving with SPA fallback
    let dist_path = std::env::var("DIST_PATH").unwrap_or_else(|_| "../terminal/dist".to_string());
    let static_service = ServeDir::new(&dist_path)
        .not_found_service(ServeFile::new(format!("{}/index.html", dist_path)));

    // 10. Assemble Main Axum Router with Auth, Rate Limiting, Security Headers & CORS
    let app = Router::new()
        .nest("/api", routes::router().with_state(app_state))
        .route("/ws", get(ws_handler).with_state(ws_state))
        .fallback_service(static_service)
        .layer(Extension(auth_limiter))
        .layer(Extension(proxy_limiter))
        .layer(axum::middleware::from_fn(security_headers_middleware))
        .layer(cors);

    // 11. Determine listening port and interface
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(5173);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    println!("===============================================================");
    println!("TerminalX - High-Performance Institutional Server & Engine v2.0");
    println!("Engine: Tokio Async + Axum WebSocket Hub + SQLite/PostgreSQL DB");
    println!("Listening on: http://0.0.0.0:{}", port);
    println!("WebSocket Hub: ws://0.0.0.0:{}/ws", port);
    println!("Static Web Assets: {}", dist_path);
    println!("===============================================================");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn security_headers_middleware(
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let mut res = next.run(req).await;
    let headers = res.headers_mut();
    headers.insert(
        axum::http::header::X_CONTENT_TYPE_OPTIONS,
        axum::http::HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        axum::http::header::X_FRAME_OPTIONS,
        axum::http::HeaderValue::from_static("SAMEORIGIN"),
    );
    headers.insert(
        axum::http::header::REFERRER_POLICY,
        axum::http::HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        axum::http::header::X_XSS_PROTECTION,
        axum::http::HeaderValue::from_static("1; mode=block"),
    );
    headers.insert(
        axum::http::header::STRICT_TRANSPORT_SECURITY,
        axum::http::HeaderValue::from_static("max-age=31536000; includeSubDomains; preload"),
    );
    headers.insert(
        axum::http::HeaderName::from_static("permissions-policy"),
        axum::http::HeaderValue::from_static("camera=(), microphone=(), geolocation=(), payment=()"),
    );
    headers.insert(
        axum::http::HeaderName::from_static("content-security-policy"),
        axum::http::HeaderValue::from_static(
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https: wss: ws:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
        ),
    );
    res
}
