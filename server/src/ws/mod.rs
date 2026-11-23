use crate::engine::{OrderRequest, TradeXGuardian};
use crate::market::{PriceStore, PriceTicker};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{broadcast, mpsc, Mutex};
use tracing::{info, warn};

pub struct WsState {
    pub price_store: PriceStore,
    pub price_tx: broadcast::Sender<PriceTicker>,
    pub guardian: Arc<Mutex<TradeXGuardian>>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "action", content = "data")]
pub enum ClientAction {
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
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<WsState>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<WsState>) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (client_tx, mut client_rx) = mpsc::channel::<Message>(512);

    info!("New client connected to CRT WebSocket Hub");

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

    // 3. Inbound reader task handling client commands
    let guardian = state.guardian.clone();
    let price_store = state.price_store.clone();
    let tx_for_replies = client_tx.clone();
    let mut inbound_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            if let Message::Text(text) = msg {
                if let Ok(action) = serde_json::from_str::<ClientAction>(&text) {
                    match action {
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
                            let g = guardian.lock().await;
                            let validation = g.validate_order(&order);
                            let reply = match validation {
                                Ok(_) => {
                                    info!("Order accepted by TradeXGuardian: {:?}", order);
                                    ServerMessage::OrderResult {
                                        success: true,
                                        message: "Order approved by TradeXGuardian".to_string(),
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
