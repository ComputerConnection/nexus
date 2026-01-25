use crate::process::manager::AgentInfo;
use dashmap::DashMap;
use uuid::Uuid;

#[cfg(feature = "database")]
use sqlx::PgPool;

pub struct AppState {
    pub agents: DashMap<Uuid, AgentInfo>,
    #[cfg(feature = "database")]
    pub db_pool: Option<PgPool>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            agents: DashMap::new(),
            #[cfg(feature = "database")]
            db_pool: None,
        }
    }

    #[cfg(feature = "database")]
    pub fn with_database(pool: PgPool) -> Self {
        Self {
            agents: DashMap::new(),
            db_pool: Some(pool),
        }
    }

    pub fn has_db(&self) -> bool {
        #[cfg(feature = "database")]
        {
            self.db_pool.is_some()
        }
        #[cfg(not(feature = "database"))]
        {
            false
        }
    }

    #[cfg(feature = "database")]
    pub fn get_pool(&self) -> Option<&PgPool> {
        self.db_pool.as_ref()
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
