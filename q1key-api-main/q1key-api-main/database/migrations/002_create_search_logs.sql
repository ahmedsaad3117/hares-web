-- Create search_logs table
CREATE TABLE IF NOT EXISTS search_logs (
  search_log_id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  search_query VARCHAR(500) NOT NULL,
  search_type VARCHAR(50) NOT NULL,
  ip_address VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_search_logs_customer ON search_logs(customer_id);
CREATE INDEX idx_search_logs_user ON search_logs(user_id);
CREATE INDEX idx_search_logs_created_at ON search_logs(created_at DESC);
CREATE INDEX idx_search_logs_search_type ON search_logs(search_type);
