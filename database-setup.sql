-- SmartResolve schema (matches src/lib/db/schema.ts)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complaint_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id UUID REFERENCES complaint_categories(id),
  location TEXT,
  department TEXT,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'NEW',
  user_id TEXT NOT NULL DEFAULT '',
  assigned_to TEXT,
  ai_analysis TEXT,
  ai_confidence REAL,
  ai_category TEXT,
  ai_priority TEXT,
  ai_department TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complaint_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_id TEXT,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sla_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority TEXT NOT NULL,
  time_limit_hours INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  related_id TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed data
INSERT INTO complaint_categories (name, description) VALUES
  ('NETWORK', 'Network connectivity issues'),
  ('HARDWARE', 'Hardware failures and requests'),
  ('SOFTWARE', 'Software installation and errors'),
  ('PRINTER', 'Printer and scanning issues'),
  ('ELECTRICITY', 'Electrical problems'),
  ('FACILITIES', 'Office facilities issues'),
  ('OTHER', 'Other issues')
ON CONFLICT (name) DO NOTHING;

INSERT INTO complaints (title, description, category_id, location, department, priority, status, user_id, ai_analysis, ai_confidence, ai_category, ai_department)
SELECT
  v.title, v.description, c.id, v.location, v.department, v.priority, v.status, 'demo-user', 'PENDING', 0.85, v.ai_category, v.ai_department
FROM (VALUES
  ('Wi-Fi keeps disconnecting', 'The office Wi-Fi drops connection every few minutes on the 3rd floor, making video calls impossible.', 'NETWORK', '3rd Floor', 'IT Infrastructure', 'HIGH', 'AI_ANALYZED', 'NETWORK', 'IT Infrastructure'),
  ('Printer out of toner', 'The shared printer near meeting room B has run out of toner and prints blank pages.', 'PRINTER', 'Meeting Room B', 'Facilities', 'LOW', 'NEW', 'PRINTER', 'Facilities'),
  ('Laptop overheating', 'My laptop shuts down unexpectedly due to overheating when compiling large projects.', 'HARDWARE', '2nd Floor', 'IT Support', 'MEDIUM', 'IN_PROGRESS', 'HARDWARE', 'IT Support'),
  ('Flickering lights', 'The lights in the kitchen area flicker constantly and one tube needs replacement.', 'ELECTRICITY', 'Kitchen', 'Facilities', 'MEDIUM', 'RESOLVED', 'ELECTRICITY', 'Facilities')
) AS v(title, description, category, location, department, priority, status, ai_category, ai_department)
JOIN complaint_categories c ON c.name = v.category
WHERE NOT EXISTS (SELECT 1 FROM complaints LIMIT 1);

INSERT INTO sla_rules (priority, time_limit_hours) VALUES
  ('CRITICAL', 2), ('HIGH', 4), ('MEDIUM', 24), ('LOW', 72)
ON CONFLICT DO NOTHING;