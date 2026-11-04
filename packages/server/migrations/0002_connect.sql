-- Browser sign-in for the extension: the extension polls with a random id until the user signs in on the web page.
CREATE TABLE connect_requests (
  id_hash TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  account_id TEXT,
  device_id TEXT,
  device_token TEXT,
  done_at INTEGER
);
