CREATE EXTENSION IF NOT EXISTS pgcrypto; -- bcrypt via crypt()/gen_salt('bf')

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('customer', 'staff'))
);

-- shortcut: expired rows are never purged, add a cleanup job if this grows large
CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  user_id    INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menu_items (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  price INT  NOT NULL CHECK (price >= 0), -- whole baht
  emoji   TEXT  NOT NULL, -- fallback when there is no image
  image   TEXT,           -- path served by the frontend, e.g. /menu/som-tam.jpg
  options JSONB NOT NULL DEFAULT '[]' -- [{"name":"ความเผ็ด","choices":["เผ็ดน้อย","เผ็ดมาก"]}], customer picks max one per group
);

CREATE TABLE orders (
  id         SERIAL PRIMARY KEY,
  user_id    INT  NOT NULL REFERENCES users(id),
  total      INT  NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'cooking', 'ready', 'done', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id       SERIAL PRIMARY KEY,
  order_id INT    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_id  INT    NOT NULL REFERENCES menu_items(id),
  qty      INT    NOT NULL CHECK (qty > 0),
  price    INT    NOT NULL, -- price snapshot at order time
  options  TEXT[] NOT NULL DEFAULT '{}' -- chosen choices, e.g. {เผ็ดมาก,หวานน้อย}
);
CREATE INDEX ON order_items (order_id);

-- shortcut: demo accounts with known passwords, change or delete them before deploying
INSERT INTO users (username, password_hash, role) VALUES
  ('staff',    crypt('staff1234',    gen_salt('bf', 10)), 'staff'),
  ('customer', crypt('customer1234', gen_salt('bf', 10)), 'customer');

INSERT INTO menu_items (name, price, emoji, image) VALUES
  ('ผัดกะเพราหมูสับไข่ดาว', 60, '🍳', '/menu/kaprao.jpg'),
  ('ข้าวผัดกุ้ง', 70, '🍤', '/menu/khao-phat-kung.jpg'),
  ('ต้มยำกุ้งน้ำข้น', 120, '🍲', '/menu/tom-yum-kung.jpg'),
  ('ส้มตำไทย', 50, '🥗', '/menu/som-tam.jpg'),
  ('ผัดไทยกุ้งสด', 75, '🍜', '/menu/phat-thai.jpg'),
  ('ข้าวมันไก่', 55, '🍗', '/menu/khao-man-kai.jpg'),
  ('ชาไทยเย็น', 35, '🧋', '/menu/cha-thai.jpg'),
  ('ข้าวเหนียวมะม่วง', 80, '🥭', '/menu/khao-niao-mamuang.jpg');

UPDATE menu_items SET options = '[{"name":"ความเผ็ด","choices":["ไม่เผ็ด","เผ็ดน้อย","เผ็ดมาก"]}]'
  WHERE name IN ('ผัดกะเพราหมูสับไข่ดาว', 'ต้มยำกุ้งน้ำข้น');
UPDATE menu_items SET options = '[{"name":"ความเผ็ด","choices":["ไม่เผ็ด","เผ็ดน้อย","เผ็ดมาก"]},{"name":"ความหวาน","choices":["ไม่หวาน","หวานน้อย","หวานมาก"]}]'
  WHERE name IN ('ส้มตำไทย', 'ผัดไทยกุ้งสด');
UPDATE menu_items SET options = '[{"name":"ความหวาน","choices":["ไม่หวาน","หวานน้อย","หวานมาก"]}]'
  WHERE name = 'ชาไทยเย็น';
