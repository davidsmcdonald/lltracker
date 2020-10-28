CREATE TABLE locations (
  username text,
  latitude text,
  longitude text,
  logtime timestamp NOT NULL,
  FOREIGN KEY (username) REFERENCES users (username) ON DELETE CASCADE
);

CREATE TABLE users (
  username text PRIMARY KEY,
  password text NOT NULL
);
