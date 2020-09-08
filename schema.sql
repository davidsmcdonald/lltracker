CREATE TABLE locations (
  user text,
  latitude text,
  longitude text,
  logtime timestamp NOT NULL,
  PRIMARY KEY (user),
  FOREIGN KEY (user) REFERENCES users (username) ON DELETE CASCADE
);

CREATE TABLE users (
  username text PRIMARY KEY,
  password text NOT NULL
);
