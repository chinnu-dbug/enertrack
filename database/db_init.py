import sqlite3
import os
import shutil
import random
from datetime import datetime, timedelta

if os.environ.get('VERCEL'):
    DB_PATH = '/tmp/energy.db'
    _bundled_db = os.path.join(os.path.dirname(__file__), 'energy.db')
    if not os.path.exists(DB_PATH) and os.path.exists(_bundled_db):
        try:
            shutil.copyfile(_bundled_db, DB_PATH)
        except Exception:
            pass
else:
    DB_PATH = os.path.join(os.path.dirname(__file__), 'energy.db')

def get_db_connection():
    if os.environ.get('VERCEL') and not os.path.exists(DB_PATH):
        _bundled_db = os.path.join(os.path.dirname(__file__), 'energy.db')
        if os.path.exists(_bundled_db):
            try:
                shutil.copyfile(_bundled_db, DB_PATH)
            except Exception:
                pass
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def seed_today_data(cursor):
    """Seed realistic readings for today so that today's metrics and AI analysis have rich data."""
    locations = ['Main Meter', 'Lab Building A', 'Library Wing', 'Computer Center', 'Cafeteria Block']
    now = datetime.now()
    readings = []
    
    hours = [1, 3, 6, 8, 10, 12, 14, 16, 18, 20, 22]
    current_hour = now.hour
    active_hours = [h for h in hours if h <= current_hour]
    if not active_hours:
        active_hours = [0, 1]

    cum_energy = {}
    for loc in locations:
        row = cursor.execute("SELECT MAX(energy_kwh) FROM energy_readings WHERE location = ?", (loc,)).fetchone()
        cum_energy[loc] = float(row[0]) if row and row[0] else random.uniform(500.0, 1200.0)

    for hour in active_hours:
        is_peak = (11 <= hour <= 17)
        reading_time = now.replace(hour=hour, minute=random.randint(5, 55), second=random.randint(0, 59))
        ts_str = reading_time.strftime('%Y-%m-%d %H:%M:%S')

        for loc in locations:
            voltage = round(random.uniform(218.0, 241.0), 1)
            base_cur = 4.2 if 'Main' in loc else 3.0
            if 'Computer' in loc:
                base_cur += 2.2

            multiplier = random.uniform(1.3, 1.8) if is_peak else random.uniform(0.8, 1.2)
            current = round(base_cur * multiplier + random.uniform(-0.3, 0.4), 2)
            pf = round(random.uniform(0.85, 0.96), 2)
            power_kw = round((voltage * current * pf) / 1000.0, 3)

            if is_peak:
                power_kw = round(power_kw * 1.6, 3)
                current = round(current * 1.6, 2)

            cum_energy[loc] += round(power_kw * 0.5, 2)
            energy_kwh = round(cum_energy[loc], 2)

            readings.append((ts_str, loc, voltage, current, power_kw, energy_kwh, pf))

    if readings:
        cursor.executemany('''
            INSERT INTO energy_readings (timestamp, location, voltage, current, power_kw, energy_kwh, power_factor)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', readings)
        print(f"Seeded {len(readings)} readings for today ({now.strftime('%Y-%m-%d')}).")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create energy_readings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS energy_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            location TEXT NOT NULL,
            voltage REAL NOT NULL,
            current REAL NOT NULL,
            power_kw REAL NOT NULL,
            energy_kwh REAL NOT NULL,
            power_factor REAL NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')
    
    # Insert default settings if not exists
    default_settings = [
        ('electricity_price', '8.0'),
        ('electricity_price_inr', '8.0'),
        ('default_meter', 'Main Meter'),
        ('refresh_interval', '5'),
        ('theme', 'light'),
        ('alert_threshold', '2.0'),
        ('sound_alert_threshold', '2.0'),
        ('sound_alert_enabled', 'true'),
        ('voltage_min', '180'),
        ('voltage_max', '260'),
        ('current_max', '100'),
        ('power_max', '100')
    ]
    for key, val in default_settings:
        cursor.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', (key, val))
        
    # Check if sample readings exist
    cursor.execute('SELECT COUNT(*) FROM energy_readings')
    count = cursor.fetchone()[0]
    
    if count == 0:
        print("Generating 30 days of realistic sample energy data...")
        generate_sample_data(cursor)

    # Ensure today's date has readings for live tracking & AI analysis
    today_prefix = datetime.now().strftime('%Y-%m-%d')
    cursor.execute("SELECT COUNT(*) FROM energy_readings WHERE timestamp LIKE ?", (f'{today_prefix}%',))
    today_count = cursor.fetchone()[0]
    if today_count == 0:
        seed_today_data(cursor)
        
    conn.commit()
    conn.close()
    print("Database initialized successfully.")

def generate_sample_data(cursor):
    locations = ['Main Meter', 'Lab Building A', 'Library Wing', 'Computer Center', 'Cafeteria Block']
    now = datetime.now()
    readings = []
    
    cumulative_energy = {loc: random.uniform(100.0, 500.0) for loc in locations}
    
    # Generate 30 days of data, 4 readings per day per location (every 6 hours)
    for day in range(30, -1, -1):
        date = now - timedelta(days=day)
        # Times: 02:00 (night), 08:00 (morning), 14:00 (afternoon), 20:00 (evening peak)
        hour_configs = [
            (2, 0.4, 0.6),    # Low nighttime usage
            (8, 0.7, 0.9),    # Morning startup
            (14, 0.85, 1.1),  # Daytime high usage
            (20, 1.1, 1.4)    # Evening peak
        ]
        
        for hour, load_mult_min, load_mult_max in hour_configs:
            reading_time = date.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
            timestamp_str = reading_time.strftime('%Y-%m-%d %H:%M:%S')
            
            for loc in locations:
                voltage = round(random.uniform(215.0, 242.0), 1)
                
                # Base current depending on location and time
                base_current = 4.0 if 'Main' in loc else 2.5
                if 'Computer' in loc:
                    base_current += 2.0
                
                multiplier = random.uniform(load_mult_min, load_mult_max)
                current = round(base_current * multiplier + random.uniform(-0.5, 0.5), 2)
                current = max(0.5, current)
                
                power_factor = round(random.uniform(0.88, 0.98), 2)
                
                # Occasional high consumption anomaly (1% chance)
                if random.random() < 0.01:
                    current = round(current * 2.2, 2)
                
                # Power = V * I * PF / 1000
                power_kw = round((voltage * current * power_factor) / 1000.0, 3)
                
                # Add increment to cumulative energy
                energy_inc = round(power_kw * random.uniform(5.5, 6.5), 2)
                cumulative_energy[loc] += energy_inc
                energy_kwh = round(cumulative_energy[loc], 2)
                
                readings.append((timestamp_str, loc, voltage, current, power_kw, energy_kwh, power_factor))
                
    cursor.executemany('''
        INSERT INTO energy_readings (timestamp, location, voltage, current, power_kw, energy_kwh, power_factor)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', readings)

if __name__ == '__main__':
    init_db()
