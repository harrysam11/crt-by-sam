use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;

use axum::{routing::get, Router};
use tokio::sync::{broadcast, Mutex, RwLock};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod engine;
mod market;
mod routes;
mod ws;

use engine::{RiskRules, TradeXGuardian};
use market::{start_binance_feed, PriceStore};
use routes::AppState;
use ws::{ws_handler, WsState};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "crt_server=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 2. Shared In-Memory Stores
    let price_store: PriceStore = Arc::new(RwLock::new(HashMap::new()));
    let (price_tx, _) = broadcast::channel(2048);

    // 3. Start Binance real-time stream in background
    start_binance_feed(price_store.clone(), price_tx.clone());

    // 4. Initialize TradeXGuardian Risk Engine
    let guardian = Arc::new(Mutex::new(TradeXGuardian::new(RiskRules::default())));

    // 5. State containers
    let app_state = Arc::new(AppState {
        start_time: Instant::now(),
        client: reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()?,
    });

    let ws_state = Arc::new(WsState {
        price_store: price_store.clone(),
        price_tx,
        guardian,
    });

    // 6. CORS configuration (Permissive for self-hosted LAN / Mobile emulators)
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // 7. Static file serving with SPA fallback
    let dist_path = std::env::var("DIST_PATH").unwrap_or_else(|_| "../terminal/dist".to_string());
    let static_service = ServeDir::new(&dist_path)
        .not_found_service(ServeFile::new(format!("{}/index.html", dist_path)));

    // 8. Assemble Main Axum Router with Security Headers & CORS
    let app = Router::new()
        .nest("/api", routes::router().with_state(app_state))
        .route("/ws", get(ws_handler).with_state(ws_state))
        .fallback_service(static_service)
        .layer(axum::middleware::from_fn(security_headers_middleware))
        .layer(cors);

    // 9. Determine listening port and interface
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(5173);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    println!("===============================================================");
    println!("CRT Institutional Terminal - High-Performance Rust Server v2.0");
    println!("Engine: Tokio Async + Axum WebSocket Hub");
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
    res
}
