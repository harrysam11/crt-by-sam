use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgPoolOptions, sqlite::SqlitePoolOptions, Pool, Postgres, Row, Sqlite};
use std::env;


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone)]
pub enum DbPool {
    Postgres(Pool<Postgres>),
    Sqlite(Pool<Sqlite>),
}

impl DbPool {
    pub async fn init() -> Result<Self, Box<dyn std::error::Error>> {
        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:terminalx.db?mode=rwc".to_string());

        if database_url.starts_with("postgres://") || database_url.starts_with("postgresql://") {
            tracing::info!("Initializing PostgreSQL pool for TerminalX...");
            let pool = PgPoolOptions::new()
                .max_connections(10)
                .connect(&database_url)
                .await?;

            // Auto-migrate tables for Postgres
            sqlx::query(
                r#"
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(36) PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    username VARCHAR(64) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at BIGINT NOT NULL,
                    updated_at BIGINT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS user_workspaces (
                    user_id VARCHAR(36) PRIMARY KEY,
                    data TEXT NOT NULL,
                    updated_at BIGINT NOT NULL
                );
                "#,
            )
            .execute(&pool)
            .await?;

            tracing::info!("PostgreSQL connection and schema initialized successfully.");
            Ok(DbPool::Postgres(pool))
        } else {
            let sqlite_url = if database_url.starts_with("sqlite:") {
                database_url
            } else {
                format!("sqlite:{}?mode=rwc", database_url)
            };

            tracing::info!("Initializing SQLite pool for TerminalX at: {}...", sqlite_url);
            let pool = SqlitePoolOptions::new()
                .max_connections(5)
                .connect(&sqlite_url)
                .await?;

            // Auto-migrate tables for SQLite
            sqlx::query(
                r#"
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS user_workspaces (
                    user_id TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                "#,
            )
            .execute(&pool)
            .await?;

            tracing::info!("SQLite connection and schema initialized successfully.");
            Ok(DbPool::Sqlite(pool))
        }
    }

    pub async fn find_user_by_email_or_username(&self, ident: &str) -> Result<Option<User>, sqlx::Error> {
        match self {
            DbPool::Postgres(pool) => {
                let row = sqlx::query(
                    "SELECT id, email, username, password_hash, created_at, updated_at FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1) LIMIT 1"
                )
                .bind(ident)
                .fetch_optional(pool)
                .await?;

                Ok(row.map(|r| User {
                    id: r.get("id"),
                    email: r.get("email"),
                    username: r.get("username"),
                    password_hash: r.get("password_hash"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                }))
            }
            DbPool::Sqlite(pool) => {
                let row = sqlx::query(
                    "SELECT id, email, username, password_hash, created_at, updated_at FROM users WHERE LOWER(email) = LOWER(?1) OR LOWER(username) = LOWER(?1) LIMIT 1"
                )
                .bind(ident)
                .fetch_optional(pool)
                .await?;

                Ok(row.map(|r| User {
                    id: r.get("id"),
                    email: r.get("email"),
                    username: r.get("username"),
                    password_hash: r.get("password_hash"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                }))
            }
        }
    }

    pub async fn find_user_by_id(&self, id: &str) -> Result<Option<User>, sqlx::Error> {
        match self {
            DbPool::Postgres(pool) => {
                let row = sqlx::query(
                    "SELECT id, email, username, password_hash, created_at, updated_at FROM users WHERE id = $1 LIMIT 1"
                )
                .bind(id)
                .fetch_optional(pool)
                .await?;

                Ok(row.map(|r| User {
                    id: r.get("id"),
                    email: r.get("email"),
                    username: r.get("username"),
                    password_hash: r.get("password_hash"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                }))
            }
            DbPool::Sqlite(pool) => {
                let row = sqlx::query(
                    "SELECT id, email, username, password_hash, created_at, updated_at FROM users WHERE id = ?1 LIMIT 1"
                )
                .bind(id)
                .fetch_optional(pool)
                .await?;

                Ok(row.map(|r| User {
                    id: r.get("id"),
                    email: r.get("email"),
                    username: r.get("username"),
                    password_hash: r.get("password_hash"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                }))
            }
        }
    }

    pub async fn create_user(&self, user: &User) -> Result<(), sqlx::Error> {
        match self {
            DbPool::Postgres(pool) => {
                sqlx::query(
                    "INSERT INTO users (id, email, username, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)"
                )
                .bind(&user.id)
                .bind(&user.email)
                .bind(&user.username)
                .bind(&user.password_hash)
                .bind(user.created_at)
                .bind(user.updated_at)
                .execute(pool)
                .await?;
            }
            DbPool::Sqlite(pool) => {
                sqlx::query(
                    "INSERT INTO users (id, email, username, password_hash, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
                )
                .bind(&user.id)
                .bind(&user.email)
                .bind(&user.username)
                .bind(&user.password_hash)
                .bind(user.created_at)
                .bind(user.updated_at)
                .execute(pool)
                .await?;
            }
        }
        Ok(())
    }

    pub async fn save_workspace(&self, user_id: &str, data: &str, updated_at: i64) -> Result<(), sqlx::Error> {
        match self {
            DbPool::Postgres(pool) => {
                sqlx::query(
                    r#"
                    INSERT INTO user_workspaces (user_id, data, updated_at)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
                    "#
                )
                .bind(user_id)
                .bind(data)
                .bind(updated_at)
                .execute(pool)
                .await?;
            }
            DbPool::Sqlite(pool) => {
                sqlx::query(
                    r#"
                    INSERT INTO user_workspaces (user_id, data, updated_at)
                    VALUES (?1, ?2, ?3)
                    ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
                    "#
                )
                .bind(user_id)
                .bind(data)
                .bind(updated_at)
                .execute(pool)
                .await?;
            }
        }
        Ok(())
    }

    pub async fn load_workspace(&self, user_id: &str) -> Result<Option<String>, sqlx::Error> {
        match self {
            DbPool::Postgres(pool) => {
                let row = sqlx::query("SELECT data FROM user_workspaces WHERE user_id = $1 LIMIT 1")
                    .bind(user_id)
                    .fetch_optional(pool)
                    .await?;
                Ok(row.map(|r| r.get("data")))
            }
            DbPool::Sqlite(pool) => {
                let row = sqlx::query("SELECT data FROM user_workspaces WHERE user_id = ?1 LIMIT 1")
                    .bind(user_id)
                    .fetch_optional(pool)
                    .await?;
                Ok(row.map(|r| r.get("data")))
            }
        }
    }
}
