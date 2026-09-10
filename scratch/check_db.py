import sqlite3

conn = sqlite3.connect('database/energy.db')
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tables:", [t[0] for t in tables])

for t in tables:
    name = t[0]
    print(f"\n--- {name} ---")
    cursor.execute(f"PRAGMA table_info({name})")
    cols = cursor.fetchall()
    print("Columns:", [c[1] for c in cols])
    cursor.execute(f"SELECT COUNT(*) FROM {name}")
    print("Rows:", cursor.fetchone()[0])
    cursor.execute(f"SELECT * FROM {name} LIMIT 2")
    rows = cursor.fetchall()
    for r in rows:
        print("  ", r)

conn.close()
