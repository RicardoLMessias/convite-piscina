ALTER TABLE confirmations
  ADD COLUMN responsible_email VARCHAR(254) NOT NULL DEFAULT '' AFTER responsible_phone;

ALTER TABLE guests
  ADD COLUMN responsible_email VARCHAR(254) NOT NULL DEFAULT '' AFTER responsible_phone;
