CREATE TABLE events (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  date_iso VARCHAR(64) NOT NULL,
  date_text VARCHAR(40) NOT NULL,
  time_text VARCHAR(40) NOT NULL,
  venue_name VARCHAR(180) NOT NULL,
  address VARCHAR(255) NOT NULL,
  map_query VARCHAR(255) NOT NULL,
  whatsapp_number VARCHAR(32) DEFAULT '',
  whatsapp_message TEXT,
  max_companions INT NOT NULL DEFAULT 8,
  allow_children TINYINT(1) NOT NULL DEFAULT 1,
  success_message VARCHAR(255) NOT NULL DEFAULT 'Confirmacao salva com sucesso.'
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE confirmations (
  id VARCHAR(64) PRIMARY KEY,
  event_id VARCHAR(64) NOT NULL,
  responsible_name VARCHAR(180) NOT NULL,
  responsible_phone VARCHAR(32) DEFAULT '',
  responsible_email VARCHAR(254) NOT NULL,
  will_attend TINYINT(1) NOT NULL DEFAULT 1,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  INDEX idx_confirmations_event (event_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE guests (
  id VARCHAR(64) PRIMARY KEY,
  event_id VARCHAR(64) NOT NULL,
  full_name VARCHAR(180) NOT NULL,
  normalized_name VARCHAR(180) NOT NULL,
  type ENUM('adult', 'child') NOT NULL DEFAULT 'adult',
  responsible_name VARCHAR(180) NOT NULL,
  responsible_phone VARCHAR(32) DEFAULT '',
  responsible_email VARCHAR(254) NOT NULL,
  status ENUM('confirmed', 'declined') NOT NULL DEFAULT 'confirmed',
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  UNIQUE KEY uniq_event_guest_name (event_id, normalized_name),
  INDEX idx_guests_event (event_id),
  INDEX idx_guests_status (status),
  INDEX idx_guests_type (type)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE guest_confirmations (
  guest_id VARCHAR(64) NOT NULL,
  confirmation_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (guest_id, confirmation_id),
  INDEX idx_guest_confirmations_confirmation (confirmation_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE duplicate_candidates (
  id VARCHAR(64) PRIMARY KEY,
  event_id VARCHAR(64) NOT NULL,
  status ENUM('pending', 'merged', 'ignored') NOT NULL DEFAULT 'pending',
  incoming_guest_id VARCHAR(64) NOT NULL,
  existing_guest_id VARCHAR(64) NOT NULL,
  incoming_name VARCHAR(180) NOT NULL,
  existing_name VARCHAR(180) NOT NULL,
  score DECIMAL(5,3) NOT NULL DEFAULT 0,
  created_at VARCHAR(40) NOT NULL,
  resolved_at VARCHAR(40) NULL,
  INDEX idx_duplicates_event_status (event_id, status)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO events (
  id,
  title,
  description,
  date_iso,
  date_text,
  time_text,
  venue_name,
  address,
  map_query,
  whatsapp_number,
  whatsapp_message,
  max_companions,
  allow_children,
  success_message
) VALUES (
  'event-demo',
  'Festa na piscina da Olivia Maria',
  'Venha comemorar esse dia especial com a Olivia.',
  '2026-12-05T13:00:00-03:00',
  '05.12.2026',
  '13:00h',
  'Chácara Gaivotas',
  'R. Laranjais, 5954 - Chácara Gaivotas, São Paulo - SP, 04849-039',
  'R. Laranjais, 5954 - Chácara Gaivotas, São Paulo - SP, 04849-039',
  '',
  'Olá, confirmo minha presença na festa da Olivia Maria.',
  8,
  1,
  'Confirmação salva com sucesso.'
);
