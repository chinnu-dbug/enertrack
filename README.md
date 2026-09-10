# EnerTrack – Electricity Data Collection System

**EnerTrack** is a clean, modern, responsive web application for collecting, managing, validating, and analyzing electricity consumption data.

> **Tagline:** Collect • Understand • Save

---

## 🌟 Features

- **Data Collection Dashboard:** Manual entry form with real-time automatic power calculation using the formula:
  $$\text{Power (kW)} = \frac{\text{Voltage (V)} \times \text{Current (A)} \times \text{Power Factor}}{1000}$$
- **Data Validation:** Strict numerical range checks for Voltage (180–260 V), Current (0–100 A), Power (0–100 kW), Energy ($\ge 0$ kWh), and Power Factor (0–1).
- **CSV Data Import & Validation:** Drag-and-drop CSV parser with preview table, row-by-row error validation, and invalid cell highlighting.
- **KPI Metrics:** Real-time summary cards for Total Readings, Energy Collected (kWh), and Peak Power (kW).
- **Interactive Data Table:** Filter by meter location, search by date/location, sort dynamically, edit, and delete records.
- **Visual Analytics:** Interactive Chart.js graphs displaying hourly collection activity and power consumption trends over time.
- **Live Stream Simulation:** Demo data stream ticker updating every 5 seconds with active simulated meter telemetry.
- **System Settings:** Configurable tariff rates, default locations, refresh intervals, and threshold limits saved in SQLite.
- **Responsive Interface:** Mobile-collapsible sidebar and horizontal scrolling data tables.

---

## 📁 Project Structure

```
enertrack/
│
├── app.py                      # Main Flask Web Server & REST APIs
├── requirements.txt            # Python Dependencies
├── README.md                   # Installation & Usage Guide
│
├── database/
│   ├── db_init.py              # SQLite Schema Initializer & 30-Day Sample Data Generator
│   └── energy.db               # SQLite Database File (auto-generated)
│
├── data/
│   └── sample_energy_data.csv  # Sample CSV file for testing data import
│
├── templates/
│   ├── layout.html             # Base Layout Template with Sidebar & Top Navbar
│   ├── collection.html         # Data Collection Dashboard
│   ├── overview.html           # System Overview Page
│   ├── live.html               # Live Telemetry Monitor Page
│   ├── analytics.html          # Analytics Page
│   ├── alerts.html             # System Alerts Page
│   ├── reports.html            # Reports Page
│   └── settings.html           # Settings Page
│
└── static/
    ├── css/
    │   └── style.css           # Custom Modern Dashboard CSS Stylesheet
    └── js/
        ├── dashboard.js        # Chart.js Initialization & Visual Data Updates
        └── collection.js       # Form Calculations, CSV Drag-Drop, Table Search & Live Simulation
```

---

## 🚀 Installation & Execution

### Prerequisites
- Python 3.8+ installed on your computer.

### Step 1: Install Dependencies
Open a command prompt or terminal in the `enertrack` directory and install the required Python packages:

```bash
pip install -r requirements.txt
```

### Step 2: Run the Application
Execute the following command to initialize the SQLite database with 30 days of realistic sample readings and start the Flask server:

```bash
python app.py
```

### Step 3: Access the Web App
Open your web browser and navigate to:
```
http://localhost:5000
```

---

## 🛠 REST API Specification

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `GET /api/readings` | GET | Retrieve readings with search, location filter, sorting, and limit parameters. |
| `POST /api/readings` | POST | Add a new energy reading with strict validation. |
| `PUT /api/readings/<id>` | PUT | Update an existing reading record. |
| `DELETE /api/readings/<id>` | DELETE | Remove a reading from the SQLite database. |
| `POST /api/upload` | POST | Upload and validate CSV files (returns preview or imports valid rows). |
| `GET /api/statistics` | GET | Retrieve summary metrics, hourly activity, and power trends. |
| `GET /api/live` | GET | Stream simulated live meter reading (clearly labeled as **Demo Data**). |
| `GET / POST /api/settings` | GET/POST| Fetch or update system settings in SQLite. |

---

## 👨‍💻 CSE Project Details

Developed as an Energy Analytics Data Collection Module using Python Flask, SQLite, Pandas, HTML5, CSS3, JavaScript, and Cha rt.js.
