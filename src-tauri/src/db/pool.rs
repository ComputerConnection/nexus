use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum PoolError {
    #[error("Failed to create connection pool: {0}")]
    ConnectionError(#[from] sqlx::Error),
    #[error("Invalid database URL")]
    InvalidUrl,
}

pub async fn create_pool(database_url: &str) -> Result<PgPool, PoolError> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(30))
        .idle_timeout(Duration::from_secs(600))
        .connect(database_url)
        .await?;

    // Run migrations if needed
    log::info!("Database pool created successfully");

    Ok(pool)
}

pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::migrate!("../migrations").run(pool).await?;
    log::info!("Database migrations completed");
    Ok(())
}
