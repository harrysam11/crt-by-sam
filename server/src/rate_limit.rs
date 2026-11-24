use axum::{
    extract::Request,
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Json, Response},
};
use serde_json::json;
use std::{
    collections::HashMap,
    net::IpAddr,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;

#[derive(Clone)]
struct ClientWindow {
    count: u32,
    window_start: Instant,
}

#[derive(Clone)]
pub struct RateLimiter {
    max_requests: u32,
    window_duration: Duration,
    clients: Arc<Mutex<HashMap<IpAddr, ClientWindow>>>,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_duration: Duration) -> Self {
        let limiter = Self {
            max_requests,
            window_duration,
            clients: Arc::new(Mutex::new(HashMap::new())),
        };

        // Spawn periodic background cleanup every 2 minutes
        let clients_clone = limiter.clients.clone();
        let cleanup_duration = window_duration;
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(120));
            loop {
                interval.tick().await;
                let mut map = clients_clone.lock().await;
                let now = Instant::now();
                map.retain(|_, win| now.duration_since(win.window_start) < cleanup_duration * 2);
            }
        });

        limiter
    }

    pub async fn check(&self, ip: IpAddr) -> Result<(), u64> {
        let mut map = self.clients.lock().await;
        let now = Instant::now();

        let entry = map.entry(ip).or_insert(ClientWindow {
            count: 0,
            window_start: now,
        });

        let elapsed = now.duration_since(entry.window_start);
        if elapsed >= self.window_duration {
            entry.count = 1;
            entry.window_start = now;
            Ok(())
        } else if entry.count < self.max_requests {
            entry.count += 1;
            Ok(())
        } else {
            let retry_after = (self.window_duration - elapsed).as_secs().max(1);
            Err(retry_after)
        }
    }
}

pub fn extract_client_ip(headers: &HeaderMap) -> IpAddr {
    // Railway / Cloudflare / Nginx headers: CF-Connecting-IP, X-Forwarded-For, X-Real-IP
    if let Some(cf_ip) = headers.get("cf-connecting-ip").and_then(|v| v.to_str().ok()) {
        if let Ok(ip) = cf_ip.trim().parse::<IpAddr>() {
            return ip;
        }
    }

    if let Some(forwarded) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        if let Some(first_ip) = forwarded.split(',').next() {
            if let Ok(ip) = first_ip.trim().parse::<IpAddr>() {
                return ip;
            }
        }
    }

    if let Some(real_ip) = headers.get("x-real-ip").and_then(|v| v.to_str().ok()) {
        if let Ok(ip) = real_ip.trim().parse::<IpAddr>() {
            return ip;
        }
    }

    // Default fallback to localhost if direct connection headers missing
    "127.0.0.1".parse().unwrap()
}

pub async fn rate_limit_auth_middleware(
    limiter: axum::extract::Extension<RateLimiter>,
    req: Request,
    next: Next,
) -> Response {
    let ip = extract_client_ip(req.headers());
    match limiter.check(ip).await {
        Ok(()) => next.run(req).await,
        Err(retry_after) => {
            let mut response = (
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({
                    "error": "Rate limit exceeded on authentication endpoint. Please slow down.",
                    "retry_after_seconds": retry_after
                })),
            )
                .into_response();
            response.headers_mut().insert(
                axum::http::header::RETRY_AFTER,
                axum::http::HeaderValue::from_str(&retry_after.to_string()).unwrap(),
            );
            response
        }
    }
}

pub async fn rate_limit_proxy_middleware(
    limiter: axum::extract::Extension<RateLimiter>,
    req: Request,
    next: Next,
) -> Response {
    let ip = extract_client_ip(req.headers());
    match limiter.check(ip).await {
        Ok(()) => next.run(req).await,
        Err(retry_after) => {
            let mut response = (
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({
                    "error": "Too many requests to proxy endpoint. Please slow down.",
                    "retry_after_seconds": retry_after
                })),
            )
                .into_response();
            response.headers_mut().insert(
                axum::http::header::RETRY_AFTER,
                axum::http::HeaderValue::from_str(&retry_after.to_string()).unwrap(),
            );
            response
        }
    }
}
