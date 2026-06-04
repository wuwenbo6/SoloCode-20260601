CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    sensor_id INTEGER NOT NULL,
    metric VARCHAR(50) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    level VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_alerts_sensor_id ON alerts(sensor_id);
CREATE INDEX IF NOT EXISTS idx_alerts_level ON alerts(level);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_metric ON alerts(metric);

CREATE TABLE IF NOT EXISTS thresholds (
    metric VARCHAR(50) PRIMARY KEY,
    min_value DOUBLE PRECISION NOT NULL,
    max_value DOUBLE PRECISION NOT NULL,
    warning_percent DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS sensors (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    area VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'normal'
);

INSERT INTO thresholds (metric, min_value, max_value, warning_percent) VALUES
    ('temperature', -20, 120, 80),
    ('pressure', 0, 10, 85),
    ('vibration', 0, 50, 80)
ON CONFLICT (metric) DO NOTHING;
