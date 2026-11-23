use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::sync::RwLock;
use tokio_tungstenite::connect_async;
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceTicker {
    pub symbol: String,
    pub price: f64,
    pub high: f64,
    pub low: f64,
    pub volume: f64,
    pub change_pct: f64,
    pub timestamp: u64,
}

#[derive(Debug, Deserialize)]
struct BinanceMiniTicker {
    #[serde(rename = "s")]
    symbol: String,
    #[serde(rename = "c")]
    close: String,
    #[serde(rename = "h")]
    high: String,
    #[serde(rename = "l")]
    low: String,
    #[serde(rename = "v")]
    volume: String,
    #[serde(rename = "E")]
    event_time: u64,
}

pub type PriceStore = Arc<RwLock<HashMap<String, PriceTicker>>>;

/// Starts a resilient background task streaming Binance 24hr mini-tickers for top pairs
pub fn start_binance_feed(
    store: PriceStore,
    tx: broadcast::Sender<PriceTicker>,
) {
    tokio::spawn(async move {
        let ws_url = "wss://fstream.binance.com/ws/!miniTicker@arr";

        loop {
            info!("Connecting to Binance Futures WebSocket stream: {}", ws_url);
            match connect_async(ws_url).await {
                Ok((ws_stream, _)) => {
                    info!("Connected to Binance Futures real-time feed!");
                    let (_, mut read) = ws_stream.split();

                    while let Some(msg_result) = read.next().await {
                        match msg_result {
                            Ok(msg) if msg.is_text() => {
                                let text = msg.into_text().unwrap_or_default();
                                if let Ok(tickers) = serde_json::from_str::<Vec<BinanceMiniTicker>>(&text) {
                                    let mut lock = store.write().await;
                                    for t in tickers {
                                        let price = t.close.parse::<f64>().unwrap_or(0.0);
                                        let high = t.high.parse::<f64>().unwrap_or(0.0);
                                        let low = t.low.parse::<f64>().unwrap_or(0.0);
                                        let volume = t.volume.parse::<f64>().unwrap_or(0.0);
                                        let change_pct = if low > 0.0 { ((price - low) / low) * 100.0 } else { 0.0 };

                                        let ticker = PriceTicker {
                                            symbol: t.symbol.clone(),
                                            price,
                                            high,
                                            low,
                                            volume,
                                            change_pct,
                                            timestamp: t.event_time,
                                        };

                                        lock.insert(t.symbol.clone(), ticker.clone());
                                        let _ = tx.send(ticker);
                                    }
                                }
                            }
                            Ok(msg) if msg.is_close() => {
                                warn!("Binance stream received close frame, reconnecting in 2s...");
                                break;
                            }
                            Err(e) => {
                                error!("Binance stream read error: {}, reconnecting in 2s...", e);
                                break;
                            }
                            _ => {}
                        }
                    }
                }
                Err(err) => {
                    error!("Failed to connect to Binance stream: {}. Retrying in 3s...", err);
                }
            }

            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        }
    });
}
