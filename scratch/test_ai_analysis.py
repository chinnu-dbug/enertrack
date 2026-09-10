import sqlite3
import datetime

def test_analysis():
    conn = sqlite3.connect('database/energy.db')
    conn.row_factory = sqlite3.Row
    today = datetime.datetime.now().strftime('%Y-%m-%d')

    # Today stats
    today_stats = conn.execute("""
        SELECT COALESCE(SUM(power_kw * 0.5), 0.0) as today_kwh,
               COUNT(*) as reading_count,
               COALESCE(MAX(power_kw), 0.0) as peak_power,
               COALESCE(AVG(power_factor), 0.0) as avg_pf,
               COALESCE(AVG(voltage), 0.0) as avg_voltage
        FROM energy_readings
        WHERE timestamp LIKE ?
    """, (today + '%',)).fetchone()

    # Historical 7-30 day daily baseline
    baseline = conn.execute("""
        SELECT AVG(daily_kwh) as avg_daily,
               MAX(daily_kwh) as max_daily,
               MIN(daily_kwh) as min_daily
        FROM (
            SELECT substr(timestamp, 1, 10) as day, SUM(power_kw * 0.5) as daily_kwh
            FROM energy_readings
            WHERE substr(timestamp, 1, 10) < ?
            GROUP BY day
        )
    """, (today,)).fetchone()

    # Today's location breakdown
    locs_today = conn.execute("""
        SELECT location,
               COUNT(*) as reading_count,
               COALESCE(SUM(power_kw * 0.5), 0.0) as loc_kwh,
               COALESCE(AVG(power_kw), 0.0) as avg_power,
               COALESCE(MAX(power_kw), 0.0) as peak_power
        FROM energy_readings
        WHERE timestamp LIKE ?
        GROUP BY location
        ORDER BY loc_kwh DESC
    """, (today + '%',)).fetchall()

    # Baseline location breakdown
    locs_baseline = conn.execute("""
        SELECT location, AVG(daily_loc_kwh) as avg_daily_kwh
        FROM (
            SELECT substr(timestamp, 1, 10) as day, location, SUM(power_kw * 0.5) as daily_loc_kwh
            FROM energy_readings
            WHERE substr(timestamp, 1, 10) < ?
            GROUP BY day, location
        )
        GROUP BY location
    """, (today,)).fetchall()

    conn.close()

    print("Today:", dict(today_stats))
    print("Baseline:", dict(baseline))
    print("Locations Today:", [dict(a) for a in locs_today])
    print("Locations Baseline:", [dict(a) for a in locs_baseline])

if __name__ == '__main__':
    test_analysis()
