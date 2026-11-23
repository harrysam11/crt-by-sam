use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskRules {
    pub max_daily_loss: f64,
    pub max_trades_per_day: u32,
    pub require_stop_loss: bool,
    pub enforce_max_risk_pct: f64,
}

impl Default for RiskRules {
    fn default() -> Self {
        Self {
            max_daily_loss: 500.0,
            max_trades_per_day: 10,
            require_stop_loss: true,
            enforce_max_risk_pct: 2.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderRequest {
    pub id: String,
    pub symbol: String,
    pub side: String, // "BUY" or "SELL"
    pub order_type: String, // "MARKET", "LIMIT", "STOP"
    pub price: f64,
    pub qty: f64,
    pub stop_loss: Option<f64>,
    pub take_profit: Option<f64>,
}

pub struct TradeXGuardian {
    pub rules: RiskRules,
    pub realized_loss_today: f64,
    pub trade_count_today: u32,
    pub emergency_locked_until: u64,
}

impl TradeXGuardian {
    pub fn new(rules: RiskRules) -> Self {
        Self {
            rules,
            realized_loss_today: 0.0,
            trade_count_today: 0,
            emergency_locked_until: 0,
        }
    }

    /// Evaluates if an order complies with pre-trade risk guardrails
    pub fn validate_order(&self, order: &OrderRequest) -> Result<(), &'static str> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Check emergency lock
        if self.emergency_locked_until > now {
            return Err("TradeXGuardian: Emergency lockout is active. Order hard-blocked.");
        }

        // Check daily loss cap
        if self.realized_loss_today >= self.rules.max_daily_loss {
            return Err("TradeXGuardian: Max daily loss limit breached. Execution disabled.");
        }

        // Check daily trade frequency
        if self.trade_count_today >= self.rules.max_trades_per_day {
            return Err("TradeXGuardian: Max daily trades count reached. Overtrading prevented.");
        }

        // Check required stop-loss
        if self.rules.require_stop_loss && order.stop_loss.is_none() {
            return Err("TradeXGuardian: Naked orders prohibited. Please specify a Stop-Loss price.");
        }

        // Check inverted SL logic
        if let Some(sl) = order.stop_loss {
            if order.side == "BUY" && sl >= order.price && order.price > 0.0 {
                return Err("TradeXGuardian: Inverted Stop-Loss. Long SL must be strictly below entry price.");
            }
            if order.side == "SELL" && sl <= order.price && order.price > 0.0 {
                return Err("TradeXGuardian: Inverted Stop-Loss. Short SL must be strictly above entry price.");
            }
        }

        Ok(())
    }
}
