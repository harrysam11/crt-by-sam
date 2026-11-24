use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskRules {
    pub max_daily_loss: f64,
    pub max_trades_per_day: u32,
    pub require_stop_loss: bool,
    pub enforce_max_risk_pct: f64, // Max risk percent of daily loss limit allowed per trade
}

impl Default for RiskRules {
    fn default() -> Self {
        Self {
            max_daily_loss: 500.0,
            max_trades_per_day: 10,
            require_stop_loss: true,
            enforce_max_risk_pct: 10.0, // 10% of daily loss max per trade
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskValidationResult {
    pub approved: bool,
    pub reason: String,
    pub calculated_risk_amount: f64,
    pub current_trade_count: u32,
    pub current_daily_loss: f64,
}

pub struct TradeXGuardian {
    pub rules: RiskRules,
    pub realized_loss_today: f64,
    pub trade_count_today: u32,
    pub emergency_locked_until: u64,
    pub last_day_epoch: u64,
}

impl TradeXGuardian {
    pub fn new(rules: RiskRules) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Self {
            rules,
            realized_loss_today: 0.0,
            trade_count_today: 0,
            emergency_locked_until: 0,
            last_day_epoch: now / 86400,
        }
    }

    /// Checks if a new day has rolled over in UTC and resets daily counters
    fn check_day_rollover(&mut self, now_secs: u64) {
        let current_day = now_secs / 86400;
        if current_day != self.last_day_epoch {
            self.last_day_epoch = current_day;
            self.trade_count_today = 0;
            self.realized_loss_today = 0.0;
            tracing::info!("TradeXGuardian: UTC day rollover occurred. Reset daily counters.");
        }
    }

    /// Evaluates if an order complies with pre-trade institutional risk guardrails
    pub fn validate_order(&mut self, order: &OrderRequest) -> Result<RiskValidationResult, &'static str> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        self.check_day_rollover(now);

        // 1. Check emergency lockout
        if self.emergency_locked_until > now {
            return Err("TradeXGuardian: Emergency lockout is active. Order hard-blocked by institutional guardian.");
        }

        // 2. Validate Symbol
        let sym = order.symbol.trim();
        if sym.is_empty() || sym.len() > 24 {
            return Err("TradeXGuardian: Invalid instrument symbol length.");
        }
        if !sym.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.') {
            return Err("TradeXGuardian: Symbol contains invalid characters.");
        }

        // 3. Validate Side (strict allowlist)
        let side = order.side.to_uppercase();
        if side != "BUY" && side != "SELL" {
            return Err("TradeXGuardian: Invalid order side. Must be 'BUY' or 'SELL'.");
        }

        // 4. Validate Order Type (strict allowlist)
        let order_type = order.order_type.to_uppercase();
        if order_type != "MARKET" && order_type != "LIMIT" && order_type != "STOP" {
            return Err("TradeXGuardian: Invalid order type. Must be 'MARKET', 'LIMIT', or 'STOP'.");
        }

        // 5. Validate Quantity (finite, positive, reasonable upper bound)
        if !order.qty.is_finite() || order.qty <= 0.0 {
            return Err("TradeXGuardian: Order quantity must be a positive, finite number.");
        }
        if order.qty > 1_000_000.0 {
            return Err("TradeXGuardian: Order quantity exceeds institutional single-order maximum threshold.");
        }

        // 6. Validate Price (finite, positive)
        if !order.price.is_finite() || order.price <= 0.0 {
            return Err("TradeXGuardian: Entry price must be a positive, finite number.");
        }

        // 7. Check Daily Realized Loss Cap
        if self.realized_loss_today >= self.rules.max_daily_loss {
            return Err("TradeXGuardian: Max daily loss limit breached. Execution disabled for today.");
        }

        // 8. Check Daily Trade Frequency Cap
        if self.trade_count_today >= self.rules.max_trades_per_day {
            return Err("TradeXGuardian: Max daily trades count reached. Overtrading protection triggered.");
        }

        // 9. Check Mandatory Stop-Loss
        if self.rules.require_stop_loss && order.stop_loss.is_none() {
            return Err("TradeXGuardian: Naked orders prohibited. Please specify a Stop-Loss price.");
        }

        // 10. Check Stop-Loss logic & calculate dollar risk
        let mut calculated_risk = 0.0;
        if let Some(sl) = order.stop_loss {
            if !sl.is_finite() || sl <= 0.0 {
                return Err("TradeXGuardian: Stop-Loss price must be a positive, finite number.");
            }

            if side == "BUY" {
                if sl >= order.price {
                    return Err("TradeXGuardian: Inverted Stop-Loss. Long SL must be strictly below entry price.");
                }
                calculated_risk = (order.price - sl) * order.qty;
            } else {
                if sl <= order.price {
                    return Err("TradeXGuardian: Inverted Stop-Loss. Short SL must be strictly above entry price.");
                }
                calculated_risk = (sl - order.price) * order.qty;
            }

            // Check max risk per trade threshold
            let max_allowed_risk = self.rules.max_daily_loss * (self.rules.enforce_max_risk_pct / 100.0);
            if calculated_risk > max_allowed_risk {
                return Err("TradeXGuardian: Single-order risk exceeds maximum allowed risk threshold per trade.");
            }
        }

        // 11. Check Take-Profit logic
        if let Some(tp) = order.take_profit {
            if !tp.is_finite() || tp <= 0.0 {
                return Err("TradeXGuardian: Take-Profit price must be a positive, finite number.");
            }

            if side == "BUY" && tp <= order.price {
                return Err("TradeXGuardian: Inverted Take-Profit. Long TP must be strictly above entry price.");
            }
            if side == "SELL" && tp >= order.price {
                return Err("TradeXGuardian: Inverted Take-Profit. Short TP must be strictly below entry price.");
            }
        }

        Ok(RiskValidationResult {
            approved: true,
            reason: "All institutional risk controls satisfied.".to_string(),
            calculated_risk_amount: calculated_risk,
            current_trade_count: self.trade_count_today,
            current_daily_loss: self.realized_loss_today,
        })
    }

    /// Records an approved order into the daily trade count
    pub fn record_order(&mut self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        self.check_day_rollover(now);
        self.trade_count_today += 1;
        tracing::info!("TradeXGuardian: Order executed. Trade count today: {}/{}", self.trade_count_today, self.rules.max_trades_per_day);
    }

    /// Records realized loss into daily accumulation
    #[allow(dead_code)]
    pub fn record_loss(&mut self, loss_amount: f64) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        self.check_day_rollover(now);
        if loss_amount > 0.0 {
            self.realized_loss_today += loss_amount;
            tracing::warn!(
                "TradeXGuardian: Realized loss recorded: ${:.2}. Total today: ${:.2}/${:.2}",
                loss_amount, self.realized_loss_today, self.rules.max_daily_loss
            );
        }
    }

    /// Engages institutional emergency lockout for a specified duration in seconds
    #[allow(dead_code)]
    pub fn set_emergency_lock(&mut self, duration_secs: u64) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        self.emergency_locked_until = now + duration_secs;
        tracing::warn!("TradeXGuardian: Emergency lockout ENGAGED until unix timestamp {}.", self.emergency_locked_until);
    }

    /// Clears emergency lockout
    #[allow(dead_code)]
    pub fn clear_emergency_lock(&mut self) {
        self.emergency_locked_until = 0;
        tracing::info!("TradeXGuardian: Emergency lockout cleared.");
    }
}
