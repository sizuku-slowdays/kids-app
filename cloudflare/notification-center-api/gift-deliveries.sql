CREATE TABLE IF NOT EXISTS gift_push_deliveries (
 delivery_id TEXT NOT NULL, endpoint TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','sending','sent')),
 lease_until INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
 PRIMARY KEY(delivery_id,endpoint)
);
