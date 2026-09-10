import unittest
import json
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app

class EnerTrackEndpointsTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_pages(self):
        pages = ['/', '/collection', '/overview', '/live', '/analytics', '/alerts', '/reports', '/settings']
        for page in pages:
            res = self.client.get(page)
            self.assertEqual(res.status_code, 200, f"Page {page} failed with {res.status_code}")

    def test_dashboard_overview(self):
        res = self.client.get('/api/dashboard/overview')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get('status'), 'success')
        self.assertIn('total_energy_kwh', data)
        self.assertIn('location_distribution', data)

    def test_alerts_ai_analysis(self):
        res = self.client.get('/api/alerts/ai-analysis')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get('status'), 'success')
        self.assertIn('location_analysis', data)
        self.assertIn('recommendations', data)

    def test_analytics_by_location(self):
        for win in ['all', 'today', 'week', 'month']:
            res = self.client.get(f'/api/analytics/by-location?window={win}')
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertEqual(data.get('status'), 'success')
            self.assertIn('locations', data)

    def test_analytics_daily_trend(self):
        res = self.client.get('/api/analytics/daily-trend?days=30&location=All')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get('status'), 'success')

    def test_readings_crud(self):
        # 1. Create reading
        payload = {
            "timestamp": "2026-09-07 23:00:00",
            "location": "Main Meter",
            "voltage": 230.0,
            "current": 5.0,
            "power_factor": 0.95,
            "power_kw": 1.0925,
            "energy_kwh": 50.0
        }
        create_res = self.client.post('/api/readings', data=json.dumps(payload), content_type='application/json')
        self.assertIn(create_res.status_code, [200, 201])
        reading_id = create_res.get_json().get('id')
        self.assertIsNotNone(reading_id)

        # 2. Get readings
        get_res = self.client.get('/api/readings?limit=5')
        self.assertEqual(get_res.status_code, 200)

        # 3. Update reading
        update_payload = {
            "timestamp": "2026-09-07 23:00:00",
            "location": "Main Meter",
            "voltage": 232.0,
            "current": 5.1,
            "power_factor": 0.96,
            "power_kw": 1.135,
            "energy_kwh": 52.0
        }
        update_res = self.client.put(f'/api/readings/{reading_id}', data=json.dumps(update_payload), content_type='application/json')
        self.assertEqual(update_res.status_code, 200)

        # 4. Delete reading
        del_res = self.client.delete(f'/api/readings/{reading_id}')
        self.assertEqual(del_res.status_code, 200)

    def test_export(self):
        csv_res = self.client.get('/api/export')
        self.assertEqual(csv_res.status_code, 200)
        self.assertEqual(csv_res.mimetype, 'text/csv')

        json_res = self.client.get('/api/export?format=json')
        self.assertEqual(json_res.status_code, 200)

    def test_live(self):
        res = self.client.get('/api/live')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get('status'), 'success')

    def test_settings(self):
        res = self.client.get('/api/settings')
        self.assertEqual(res.status_code, 200)

    def test_internet_telemetry_examine_and_import(self):
        # 1. Examine
        res = self.client.get('/api/internet-telemetry/examine')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get('status'), 'success')
        self.assertIn('examination', data)
        readings = data['examination']['meter_readings']
        self.assertTrue(len(readings) > 0)

        # 2. Import
        import_res = self.client.post('/api/internet-telemetry/import', data=json.dumps({'readings': readings}), content_type='application/json')
        self.assertEqual(import_res.status_code, 200)
        import_data = import_res.get_json()
        self.assertEqual(import_data.get('status'), 'success')
        self.assertEqual(import_data.get('imported_count'), len(readings))

if __name__ == '__main__':
    unittest.main()
