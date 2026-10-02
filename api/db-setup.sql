-- One-time MySQL setup for the RAGE:MP API.
-- Replace the placeholder password below, then run as root:
--   sudo mysql < /opt/ragemp-srv/api/db-setup.sql
-- Use the SAME password in api/.env (DB_PASS). .env is gitignored; keep the real password only there.
CREATE DATABASE IF NOT EXISTS ragemp
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'ragemp_api'@'localhost'
  IDENTIFIED BY 'CHANGE_ME';

GRANT ALL PRIVILEGES ON ragemp.* TO 'ragemp_api'@'localhost';
FLUSH PRIVILEGES;
