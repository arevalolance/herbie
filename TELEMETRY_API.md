# Telemetry API Documentation

This document provides comprehensive guidance for integrating your Python telemetry tracker with the Herbie backend API routes.

## Overview

The Telemetry API consists of 7 core endpoints that follow the natural data hierarchy of racing telemetry:

1. **Sessions** - Create racing sessions
2. **Vehicles** - Create vehicle records
3. **Laps** - Create lap records
4. **Timing** - Create timing data
5. **Data** - Bulk insert telemetry logs and related data
6. **Summary** - Create lap summaries
7. **Conditions** - Create session conditions

## Base URL

All endpoints are under: `/api/telemetry/`

## Authentication

Currently, the API doesn't include authentication. User identification is handled via the `user_id` parameter in requests.

## Data Flow

The typical integration workflow follows this sequence:

```
1. Create Session → 2. Create Vehicle → 3. For each lap:
   a. Create Lap
   b. Create Timing Data
   c. Bulk Insert Telemetry Data
   d. Create Lap Summary
   e. Create Session Conditions (optional)
```

---

## API Endpoints

### 1. POST /api/telemetry/sessions

Creates a new racing session.

**Required Fields:**
- `user_id` (string): User identifier
- `session_type` (number): Type of session (0-10)
- `track_name` (string): Name of the track

**Request Body:**
```json
{
  "user_id": "user_123",
  "session_type": 1,
  "track_name": "Silverstone",
  "session_stamp": 1703098800000,
  "combo_id": "silverstone_gp",
  "track_id": "silverstone",
  "sim_name": "rFactor 2",
  "api_version": "1.0",
  "session_length": 1800.0,
  "max_laps": 50,
  "is_lap_type": true,
  "title": "Practice Session",
  "description": "Morning practice session"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": "user_123",
    "session_stamp": "1703098800000",
    "session_type": 1,
    "track_name": "Silverstone",
    "created_at": "2024-12-21T10:00:00.000Z"
  },
  "message": "Session created successfully"
}
```

---

### 2. POST /api/telemetry/vehicles

Creates a vehicle record for a session.

**Required Fields:**
- `session_id` (number): Session ID from previous step
- `slot_id` (number): Vehicle slot identifier
- `driver_name` (string): Driver name
- `vehicle_name` (string): Vehicle name

**Request Body:**
```json
{
  "session_id": 1,
  "slot_id": 0,
  "driver_name": "John Doe",
  "vehicle_name": "Formula 1 Car",
  "class_name": "Formula 1",
  "is_player": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "session_id": 1,
    "slot_id": 0,
    "driver_name": "John Doe",
    "vehicle_name": "Formula 1 Car",
    "class_name": "Formula 1",
    "is_player": true,
    "created_at": "2024-12-21T10:00:00.000Z"
  },
  "message": "Vehicle created successfully"
}
```

---

### 3. POST /api/telemetry/laps

Creates a lap record.

**Required Fields:**
- `user_id` (string): User identifier
- `session_id` (number): Session ID
- `vehicle_id` (number): Vehicle ID
- `lap_number` (number): Lap number
- `lap_start_time` (string): ISO timestamp of lap start

**Request Body:**
```json
{
  "user_id": "user_123",
  "session_id": 1,
  "vehicle_id": 1,
  "lap_number": 1,
  "title": "Lap 1",
  "description": "First lap of the session",
  "tags": "practice,qualifying",
  "lap_time": 82.456,
  "sector1_time": 28.123,
  "sector2_time": 31.456,
  "sector3_time": 22.877,
  "is_valid": true,
  "is_personal_best": false,
  "lap_start_time": "2024-12-21T10:05:00.000Z",
  "lap_end_time": "2024-12-21T10:06:22.456Z",
  "track_temp": 35.5,
  "ambient_temp": 18.2,
  "wetness": 0.0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": "user_123",
    "session_id": 1,
    "vehicle_id": 1,
    "lap_number": 1,
    "lap_time": 82.456,
    "is_valid": true,
    "created_at": "2024-12-21T10:00:00.000Z"
  },
  "message": "Lap created successfully"
}
```

---

### 4. POST /api/telemetry/timing

Creates timing data for a lap.

**Required Fields:**
- `lap_id` (number): Lap ID from previous step

**Request Body:**
```json
{
  "lap_id": 1,
  "sector1_time": 28.123,
  "sector2_time": 31.456,
  "sector3_time": 22.877,
  "sector1_best": 27.891,
  "sector2_best": 31.123,
  "sector3_best": 22.654,
  "delta_to_personal_best": 0.234,
  "delta_to_session_best": -0.123,
  "start_position": 3,
  "end_position": 2
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "lap_id": 1,
    "sector1_time": 28.123,
    "sector2_time": 31.456,
    "delta_to_personal_best": 0.234
  },
  "message": "Timing data created successfully"
}
```

---

### 5. POST /api/telemetry/data

Bulk inserts telemetry logs and all related data. This is the main endpoint for telemetry data.

**Required Fields:**
- `lap_id` (number): Lap ID
- `telemetry_points` (array): Array of telemetry data points

**Request Body:**
```json
{
  "lap_id": 1,
  "telemetry_points": [
    {
      "timestamp": "2024-12-21T10:05:00.000Z",
      "session_elapsed": 300.0,
      "lap_progress": 0.0,
      "position_x": 1000.5,
      "position_y": 500.2,
      "position_z": 10.1,
      "orientation_yaw": 1.57,
      "speed": 180.5,
      "accel_lateral": 1.2,
      "accel_longitudinal": 0.8,
      "accel_vertical": -9.8,
      "velocity_lateral": 2.1,
      "velocity_longitudinal": 50.0,
      "velocity_vertical": 0.1,
      "gear": 5,
      "rpm": 8500.0,
      "throttle": 0.85,
      "brake": 0.0,
      "clutch": 0.0,
      "steering": 0.12,
      "fuel": 45.6,
      "track_edge": 2.5,
      "path_lateral": 0.8,
      "engine": {
        "gear": 5,
        "max_gear": 6,
        "rpm": 8500.0,
        "max_rpm": 9000.0,
        "torque": 350.0,
        "turbo_boost": 1.2,
        "oil_temperature": 110.5,
        "water_temperature": 85.2
      },
      "input": {
        "throttle": 0.85,
        "throttle_raw": 0.87,
        "brake": 0.0,
        "brake_raw": 0.0,
        "clutch": 0.0,
        "clutch_raw": 0.0,
        "steering": 0.12,
        "steering_raw": 0.15,
        "steering_shaft_torque": 12.5,
        "steering_range_physical": 900.0,
        "steering_range_visual": 360.0,
        "force_feedback": 0.75
      },
      "brake_data": {
        "bias_front": 0.6,
        "pressure_fl": 1200.0,
        "pressure_fr": 1200.0,
        "pressure_rl": 800.0,
        "pressure_rr": 800.0,
        "temperature_fl": 350.0,
        "temperature_fr": 350.0,
        "temperature_rl": 280.0,
        "temperature_rr": 280.0
      },
      "tyre": {
        "compound_front": 1,
        "compound_rear": 1,
        "compound_name_front": "Soft",
        "compound_name_rear": "Soft",
        "surface_temp_fl": 85.5,
        "surface_temp_fr": 86.2,
        "surface_temp_rl": 82.1,
        "surface_temp_rr": 83.7,
        "inner_temp_fl": 90.5,
        "inner_temp_fr": 91.2,
        "inner_temp_rl": 87.1,
        "inner_temp_rr": 88.7,
        "pressure_fl": 23.5,
        "pressure_fr": 23.5,
        "pressure_rl": 21.0,
        "pressure_rr": 21.0,
        "load_fl": 4500.0,
        "load_fr": 4500.0,
        "load_rl": 3800.0,
        "load_rr": 3800.0,
        "wear_fl": 0.02,
        "wear_fr": 0.02,
        "wear_rl": 0.01,
        "wear_rr": 0.01,
        "carcass_temp_fl": 88.0,
        "carcass_temp_fr": 89.0,
        "carcass_temp_rl": 85.0,
        "carcass_temp_rr": 86.0
      },
      "wheel": {
        "camber_fl": -3.5,
        "camber_fr": -3.5,
        "camber_rl": -2.0,
        "camber_rr": -2.0,
        "toe_fl": 0.0,
        "toe_fr": 0.0,
        "toe_rl": 0.2,
        "toe_rr": 0.2,
        "rotation_fl": 100.0,
        "rotation_fr": 100.0,
        "rotation_rl": 98.0,
        "rotation_rr": 98.0,
        "vel_lateral_fl": 2.1,
        "vel_lateral_fr": 2.1,
        "vel_lateral_rl": 1.8,
        "vel_lateral_rr": 1.8,
        "vel_longitudinal_fl": 50.0,
        "vel_longitudinal_fr": 50.0,
        "vel_longitudinal_rl": 49.5,
        "vel_longitudinal_rr": 49.5,
        "ride_height_fl": 25.0,
        "ride_height_fr": 25.0,
        "ride_height_rl": 75.0,
        "ride_height_rr": 75.0,
        "suspension_deflection_fl": 0.02,
        "suspension_deflection_fr": 0.02,
        "suspension_deflection_rl": 0.03,
        "suspension_deflection_rr": 0.03,
        "suspension_force_fl": 4500.0,
        "suspension_force_fr": 4500.0,
        "suspension_force_rl": 3800.0,
        "suspension_force_rr": 3800.0,
        "third_spring_deflection_fl": 0.0,
        "third_spring_deflection_fr": 0.0,
        "third_spring_deflection_rl": 0.0,
        "third_spring_deflection_rr": 0.0,
        "position_vertical_fl": 0.25,
        "position_vertical_fr": 0.25,
        "position_vertical_rl": 0.75,
        "position_vertical_rr": 0.75,
        "is_detached_fl": false,
        "is_detached_fr": false,
        "is_detached_rl": false,
        "is_detached_rr": false,
        "is_offroad": false
      },
      "vehicle_state": {
        "place": 1,
        "qualification": 1,
        "in_pits": false,
        "in_garage": false,
        "num_pitstops": 0,
        "pit_request": false,
        "num_penalties": 0,
        "finish_state": 0,
        "fuel": 45.6,
        "tank_capacity": 100.0,
        "downforce_front": 1200.0,
        "downforce_rear": 800.0,
        "is_detached": false,
        "last_impact_time": 0.0,
        "last_impact_magnitude": 0.0
      },
      "switch_states": {
        "headlights": 0,
        "ignition_starter": 1,
        "speed_limiter": 0,
        "drs_status": 0,
        "auto_clutch": false
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "telemetry_count": 1,
    "engine_count": 1,
    "input_count": 1,
    "brake_count": 1,
    "tyre_count": 1,
    "wheel_count": 1,
    "vehicle_state_count": 1,
    "switch_count": 1
  },
  "message": "Telemetry data inserted successfully"
}
```

---

### 6. POST /api/telemetry/summary

Creates a lap summary with calculated statistics.

**Required Fields:**
- `lap_id` (number): Lap ID

**Request Body:**
```json
{
  "lap_id": 1,
  "max_speed": 320.5,
  "avg_speed": 180.2,
  "min_speed": 45.0,
  "max_rpm": 8500.0,
  "avg_rpm": 7200.0,
  "max_throttle": 1.0,
  "avg_throttle": 0.65,
  "max_brake": 1.0,
  "avg_brake": 0.15,
  "max_lateral_g": 3.2,
  "max_longitudinal_g": 2.8,
  "max_vertical_g": 1.5,
  "max_tire_temp": 95.5,
  "avg_tire_temp": 85.2,
  "max_tire_pressure": 24.0,
  "avg_tire_pressure": 22.5,
  "fuel_used": 2.4,
  "fuel_starting": 48.0,
  "fuel_ending": 45.6,
  "distance_covered": 5891.2
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "lap_id": 1,
    "max_speed": 320.5,
    "avg_speed": 180.2,
    "fuel_used": 2.4,
    "distance_covered": 5891.2,
    "created_at": "2024-12-21T10:00:00.000Z"
  },
  "message": "Lap summary created successfully"
}
```

---

### 7. POST /api/telemetry/conditions

Creates session conditions data.

**Required Fields:**
- `session_id` (number): Session ID
- `timestamp` (string): ISO timestamp

**Request Body:**
```json
{
  "session_id": 1,
  "timestamp": "2024-12-21T10:05:00.000Z",
  "track_temperature": 35.5,
  "ambient_temperature": 18.2,
  "raininess": 0.0,
  "wetness_minimum": 0.0,
  "wetness_maximum": 0.0,
  "wetness_average": 0.0,
  "game_phase": 1,
  "in_countdown": false,
  "in_formation": false,
  "pit_open": true,
  "green_flag": true,
  "yellow_flag": false,
  "start_lights": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "session_id": 1,
    "timestamp": "2024-12-21T10:05:00.000Z",
    "track_temperature": 35.5,
    "ambient_temperature": 18.2,
    "game_phase": 1
  },
  "message": "Session conditions created successfully"
}
```

---

## Error Handling

All endpoints return errors in a consistent format:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors, missing fields)
- `404` - Not Found (referenced resources don't exist)
- `500` - Internal Server Error (database or server issues)

---

## Integration Tips

### 1. Data Validation
All endpoints include comprehensive data validation. Optional fields can be omitted or sent as `null`.

### 2. Batch Operations
The `/data` endpoint is optimized for bulk inserts. Send as many telemetry points as possible in a single request for better performance.

### 3. Error Recovery
If any request fails, check the error message and ensure all required fields are provided with valid data types.

### 4. Testing
Test each endpoint individually before implementing the full workflow. Start with small datasets.

### 5. Performance
- Use the bulk `/data` endpoint for telemetry data instead of individual inserts
- Consider batching requests when possible
- Monitor response times for large datasets

---

## Example Python Integration

```python
import requests
import json
from datetime import datetime

class TelemetryAPI:
    def __init__(self, base_url="http://localhost:3000/api/telemetry"):
        self.base_url = base_url
    
    def create_session(self, user_id, session_type, track_name, **kwargs):
        data = {
            "user_id": user_id,
            "session_type": session_type,
            "track_name": track_name,
            **kwargs
        }
        response = requests.post(f"{self.base_url}/sessions", json=data)
        return response.json()
    
    def create_vehicle(self, session_id, slot_id, driver_name, vehicle_name, **kwargs):
        data = {
            "session_id": session_id,
            "slot_id": slot_id,
            "driver_name": driver_name,
            "vehicle_name": vehicle_name,
            **kwargs
        }
        response = requests.post(f"{self.base_url}/vehicles", json=data)
        return response.json()
    
    def create_lap(self, user_id, session_id, vehicle_id, lap_number, **kwargs):
        data = {
            "user_id": user_id,
            "session_id": session_id,
            "vehicle_id": vehicle_id,
            "lap_number": lap_number,
            "lap_start_time": datetime.now().isoformat(),
            **kwargs
        }
        response = requests.post(f"{self.base_url}/laps", json=data)
        return response.json()
    
    def insert_telemetry_data(self, lap_id, telemetry_points):
        data = {
            "lap_id": lap_id,
            "telemetry_points": telemetry_points
        }
        response = requests.post(f"{self.base_url}/data", json=data)
        return response.json()

# Usage example
api = TelemetryAPI()

# 1. Create session
session = api.create_session(
    user_id="user_123",
    session_type=1,
    track_name="Silverstone"
)
session_id = session["data"]["id"]

# 2. Create vehicle
vehicle = api.create_vehicle(
    session_id=session_id,
    slot_id=0,
    driver_name="John Doe",
    vehicle_name="Formula 1 Car"
)
vehicle_id = vehicle["data"]["id"]

# 3. Create lap
lap = api.create_lap(
    user_id="user_123",
    session_id=session_id,
    vehicle_id=vehicle_id,
    lap_number=1
)
lap_id = lap["data"]["id"]

# 4. Insert telemetry data
telemetry_points = [
    {
        "timestamp": datetime.now().isoformat(),
        "speed": 180.5,
        "rpm": 8500.0,
        "throttle": 0.85,
        # ... more telemetry data
    }
]

result = api.insert_telemetry_data(lap_id, telemetry_points)
print(f"Inserted {result['data']['telemetry_count']} telemetry points")
```

---

## Next Steps

1. Test each endpoint with your Python tracker
2. Implement error handling and retry logic
3. Optimize batch sizes for the `/data` endpoint
4. Add logging for debugging and monitoring
5. Consider adding authentication if needed

For questions or issues, refer to the route implementations in `/app/api/telemetry/`.