-- Additive only: preserve reward IDs, prices, stock, requests and ledger history.
ALTER TABLE passbook_rewards ADD COLUMN image_url TEXT;
ALTER TABLE passbook_rewards ADD COLUMN image_override INTEGER NOT NULL DEFAULT 0 CHECK(image_override IN (0,1));
ALTER TABLE passbook_rewards ADD COLUMN edit_revision INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER passbook_reward_stock_revision AFTER UPDATE OF stock ON passbook_rewards WHEN NEW.stock IS NOT OLD.stock
BEGIN
 UPDATE passbook_rewards SET edit_revision=edit_revision+1 WHERE id=NEW.id;
END;
