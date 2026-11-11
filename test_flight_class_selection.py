"""
End-to-End Simulation of Flight Class Selection & Hand-off to Seat Selection
"""
import json
import unittest
import app

class TestFlightClassSelection(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()

    def test_search_api_returns_fares_and_ids(self):
        res = self.client.get('/api/flights/search?trip_type=one-way&source=Dubai+(DXB)&destination=Mumbai+(BOM)&departure_date=2026-11-11&passengers=2')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertTrue(data['outbound']['has_flights'])
        flights = data['outbound']['flights']
        self.assertGreater(len(flights), 0)

        f = flights[0]
        # Verify IDs and fares
        self.assertIn('id', f)
        self.assertIn('flight_id', f)
        self.assertIn('economyFare', f)
        self.assertIn('businessFare', f)
        self.assertEqual(f['economyFare'], 5500.0)
        self.assertEqual(f['businessFare'], 14300.0)
        self.assertEqual(f['totalFareEconomy'], 11000.0) # 2 pax
        self.assertEqual(f['totalFareBusiness'], 28600.0) # 2 pax

    def test_round_trip_fares(self):
        res = self.client.get('/api/flights/search?trip_type=round-trip&source=Dubai+(DXB)&destination=Mumbai+(BOM)&departure_date=2026-11-11&return_date=2026-11-14&passengers=1')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertTrue(data['outbound']['has_flights'])
        self.assertTrue(data['return']['has_flights'])

        out_f = data['outbound']['flights'][0]
        ret_f = data['return']['flights'][0]
        self.assertEqual(out_f['economyFare'], 5500.0)
        self.assertEqual(out_f['businessFare'], 14300.0)
        self.assertEqual(ret_f['economyFare'], 4800.0)
        self.assertEqual(ret_f['businessFare'], 12480.0)

    def test_selection_payload_contract(self):
        # Simulate Economy selection for Outbound
        res = self.client.get('/api/flights/search?trip_type=one-way&source=Dubai+(DXB)&destination=Mumbai+(BOM)&departure_date=2026-11-11&passengers=1')
        flight = res.get_json()['outbound']['flights'][0]

        selection_payload_eco = {
            "flight_id": flight['id'],
            "cabinClass": "economy",
            "departureDate": "2026-11-11",
            "totalPassengers": 1,
            "tripType": "one-way",
            "searchQuery": {
                "tripType": "one-way",
                "origin": "Dubai (DXB)",
                "destination": "Mumbai (BOM)",
                "departureDate": "2026-11-11",
                "passengers": {"total": 1, "adults": 1, "children": 0, "infants": 0},
                "cabinClass": "economy"
            },
            "outbound": {
                "flight": flight,
                "cabin": "economy",
                "fare": flight['economyFare']
            },
            "return": None,
            "totalFareFormatted": f"₹{int(flight['economyFare']):,}"
        }

        # Validate that seat-selection logic can extract cabin and fare
        self.assertEqual(selection_payload_eco['outbound']['cabin'], 'economy')
        self.assertEqual(selection_payload_eco['outbound']['fare'], 5500.0)
        self.assertEqual(selection_payload_eco['flight_id'], 1)

        # Simulate Business selection for Outbound
        selection_payload_biz = {
            "flight_id": flight['id'],
            "cabinClass": "business",
            "departureDate": "2026-11-11",
            "totalPassengers": 1,
            "tripType": "one-way",
            "searchQuery": {
                "tripType": "one-way",
                "origin": "Dubai (DXB)",
                "destination": "Mumbai (BOM)",
                "departureDate": "2026-11-11",
                "passengers": {"total": 1, "adults": 1, "children": 0, "infants": 0},
                "cabinClass": "business"
            },
            "outbound": {
                "flight": flight,
                "cabin": "business",
                "fare": flight['businessFare']
            },
            "return": None,
            "totalFareFormatted": f"₹{int(flight['businessFare']):,}"
        }

        self.assertEqual(selection_payload_biz['outbound']['cabin'], 'business')
        self.assertEqual(selection_payload_biz['outbound']['fare'], 14300.0)
        self.assertEqual(selection_payload_biz['flight_id'], 1)

if __name__ == '__main__':
    unittest.main()
