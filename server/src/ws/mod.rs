use crate::auth::verify_token;
use crate::engine::{OrderRequest, TradeXGuardian};
use crate::market::{PriceStore, PriceTicker};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::{broadcast, mpsc, Mutex};
use tracing::{info, warn};

pub struct WsState {
    pub price_store: PriceStore,
    pub price_tx: broadcast::Sender<PriceTicker>,
    pub guardian: Arc<Mutex<TradeXGuardian>>,
}

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub token: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "action", content = "data")]
pub enum ClientAction {
    #[serde(rename = "auth")]
    Auth { token: String },
    #[serde(rename = "subscribe")]
    Subscribe { symbol: String },
    #[serde(rename = "order")]
    PlaceOrder(OrderRequest),
    #[serde(rename = "ping")]
    Ping,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum ServerMessage {
    #[serde(rename = "auth_result")]
    AuthResult {
        success: bool,
        message: String,
        user_id: Option<String>,
    },
    #[serde(rename = "ticker")]
    Ticker(PriceTicker),
    #[serde(rename = "order_result")]
    OrderResult {
        success: bool,
        message: String,
        order_id: Option<String>,
    },
    #[serde(rename = "pong")]
    Pong { timestamp: u64 },
    #[serde(rename = "error")]
    Error { message: String },
}

fn is_allowed_origin(headers: &HeaderMap) -> bool {
    if let Some(origin) = headers.get("origin").and_then(|v| v.to_str().ok()) {
        let o = origin.to_lowercase();
        if o.starts_with("http://localhost")
            || o.starts_with("https://localhost")
            || o.starts_with("http://127.0.0.1")
            || o.starts_with("https://127.0.0.1")
            || o.contains("terminalx")
            || o.contains("railway.app")
            || o.starts_with("capacitor://")
            || o.starts_with("ionic://")
        {
            return true;
        }
        warn!("WebSocket connection rejected due to unapproved Origin: {}", origin);
        return false;
    }
    // Allow non-browser direct clients
    true
}

pub async fn ws_handler(
    headers: HeaderMap,
    Query(query): Query<WsQuery>,
    ws: WebSocketUpgrade,
    State(state): State<Arc<WsState>>,
) -> Response {
    if !is_allowed_origin(&headers) {
        return (StatusCode::FORBIDDEN, "Cross-Origin WebSocket connection denied.").into_response();
    }

    let initial_user = query.token.and_then(|t| verify_token(&t).ok().map(|c| c.sub));

    ws.on_upgrade(move |socket| handle_socket(socket, state, initial_user))
}

async fn handle_socket(socket: WebSocket, state: Arc<WsState>, initial_user_id: Option<String>) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (client_tx, mut client_rx) = mpsc::channel::<Message>(512);

    info!("New client connected to CRT WebSocket Hub (authenticated: {})", initial_user_id.is_some());

    // 1. Single outbound transmitter task to WebSocket connection
    let mut outbound_task = tokio::spawn(async move {
        while let Some(msg) = client_rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // 2. Broadcast price ticker subscriber forwarding to client
    let tx_for_tickers = client_tx.clone();
    let mut price_rx = state.price_tx.subscribe();
    let mut ticker_task = tokio::spawn(async move {
        while let Ok(ticker) = price_rx.recv().await {
            let msg = ServerMessage::Ticker(ticker);
            if let Ok(json) = serde_json::to_string(&msg) {
                if tx_for_tickers.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
        }
    });

    // 3. Inbound reader task handling client commands with per-connection rate limit
    let guardian = state.guardian.clone();
    let price_store = state.price_store.clone();
    let tx_for_replies = client_tx.clone();

    let mut inbound_task = tokio::spawn(async move {
        let mut authenticated_user: Option<String> = initial_user_id;
        let mut msg_window_start = Instant::now();
        let mut msg_count = 0u32;
        const MAX_MESSAGES_PER_SEC: u32 = 40;
        const MAX_PAYLOAD_BYTES: usize = 65_536; // 64 KB

        while let Some(Ok(msg)) = ws_receiver.next().await {
            match msg {
                Message::Text(text) => {
                    // Payload size limit
                    if text.len() > MAX_PAYLOAD_BYTES {
                        let err = ServerMessage::Error {
                            message: "Message payload exceeds 64KB limit.".to_string(),
                        };
                        if let Ok(j) = serde_json::to_string(&err) {
                            let _ = tx_for_replies.send(Message::Text(j)).await;
                        }
                        continue;
                    }

                    // Per-connection message rate limit
                    let now = Instant::now();
                    if now.duration_since(msg_window_start) >= Duration::from_secs(1) {
                        msg_window_start = now;
                        msg_count = 1;
                    } else {
                        msg_count += 1;
                        if msg_count > MAX_MESSAGES_PER_SEC {
                            let err = ServerMessage::Error {
                                message: "WebSocket message rate limit exceeded (max 40 msg/sec).".to_string(),
                            };
                            if let Ok(j) = serde_json::to_string(&err) {
                                let _ = tx_for_replies.send(Message::Text(j)).await;
                            }
                            continue;
                        }
                    }

                    if let Ok(action) = serde_json::from_str::<ClientAction>(&text) {
                        match action {
                            ClientAction::Auth { token } => {
                                match verify_token(&token) {
                                    Ok(claims) => {
                                        authenticated_user = Some(claims.sub.clone());
                                        info!("WebSocket session successfully authenticated for user: {}", claims.sub);
                                        let reply = ServerMessage::AuthResult {
                                            success: true,
                                            message: "Authentication successful.".to_string(),
                                            user_id: Some(claims.sub),
                                        };
                                        if let Ok(json) = serde_json::to_string(&reply) {
                                            let _ = tx_for_replies.send(Message::Text(json)).await;
                                        }
                                    }
                                    Err(_) => {
                                        warn!("WebSocket authentication failed with invalid or expired token");
                                        let reply = ServerMessage::AuthResult {
                                            success: false,
                                            message: "Invalid or expired token.".to_string(),
                                            user_id: None,
                                        };
                                        if let Ok(json) = serde_json::to_string(&reply) {
                                            let _ = tx_for_replies.send(Message::Text(json)).await;
                                        }
                                    }
                                }
                            }
                            ClientAction::Subscribe { symbol } => {
                                let store = price_store.read().await;
                                if let Some(ticker) = store.get(&symbol) {
                                    let reply = ServerMessage::Ticker(ticker.clone());
                                    if let Ok(json) = serde_json::to_string(&reply) {
                                        let _ = tx_for_replies.send(Message::Text(json)).await;
                                    }
                                }
                            }
                            ClientAction::PlaceOrder(order) => {
                                let order_id = order.id.clone();

                                // Require authentication before risk validation and order processing
                                if authenticated_user.is_none() {
                                    warn!("Anonymous order attempt blocked on WebSocket: order_id={}", order_id);
                                    let reply = ServerMessage::OrderResult {
                                        success: false,
                                        message: "Authentication required to submit orders for pre-trade risk validation.".to_string(),
                                        order_id: Some(order_id),
                                    };
                                    if let Ok(json) = serde_json::to_string(&reply) {
                                        let _ = tx_for_replies.send(Message::Text(json)).await;
                                    }
                                    continue;
                                }

                                let mut g = guardian.lock().await;
                                let validation = g.validate_order(&order);
                                let reply = match validation {
                                    Ok(res) => {
                                        g.record_order();
                                        info!(
                                            "Order approved by TradeXGuardian for user {:?}: {:?} (Risk: ${:.2})",
                                            authenticated_user, order, res.calculated_risk_amount
                                        );
                                        ServerMessage::OrderResult {
                                            success: true,
                                            message: format!(
                                                "Order approved by TradeXGuardian. (Trade #{}/{}, Risk: ${:.2})",
                                                res.current_trade_count + 1,
                                                g.rules.max_trades_per_day,
                                                res.calculated_risk_amount
                                            ),
                                            order_id: Some(order_id),
                                        }
                                    }
                                    Err(err) => {
                                        warn!("Order blocked by TradeXGuardian: {}", err);
                                        ServerMessage::OrderResult {
                                            success: false,
                                            message: err.to_string(),
                                            order_id: Some(order_id),
                                        }
                                    }
                                };

                                if let Ok(json) = serde_json::to_string(&reply) {
                                    let _ = tx_for_replies.send(Message::Text(json)).await;
                                }
                            }
                            ClientAction::Ping => {
                                let now = SystemTime::now()
                                    .duration_since(UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_millis() as u64;
                                let pong = ServerMessage::Pong { timestamp: now };
                                if let Ok(json) = serde_json::to_string(&pong) {
                                    let _ = tx_for_replies.send(Message::Text(json)).await;
                                }
                            }
                        }
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    // Abort sibling tasks on disconnect
    tokio::select! {
        _ = (&mut outbound_task) => {
            ticker_task.abort();
            inbound_task.abort();
        }
        _ = (&mut inbound_task) => {
            ticker_task.abort();
            outbound_task.abort();
        }
        _ = (&mut ticker_task) => {
            outbound_task.abort();
            inbound_task.abort();
        }
    };

    info!("Client disconnected from CRT WebSocket Hub");
}
