use parking_lot::Mutex;
use std::{collections::HashMap, collections::VecDeque};
use tokio::process::Child;

#[derive(Default)]
pub struct AppState {
    pub processes: Mutex<HashMap<String, Child>>,
    pub logs: Mutex<VecDeque<String>>,
}

impl AppState {
    pub fn push_log(&self, message: impl Into<String>) {
        const MAX_LOG_LINES: usize = 500;
        let mut logs = self.logs.lock();
        if logs.len() >= MAX_LOG_LINES {
            logs.pop_front();
        }
        logs.push_back(message.into());
    }
}
