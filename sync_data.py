import requests
import sqlite3
import json
from datetime import datetime
import os
from dotenv import load_dotenv


# --- CONFIGURATION ---

load_dotenv()
API_TOKEN = os.getenv("CLOUDLOOP_API_TOKEN")

API_URL = "https://cloudloop-webhook.rkey.workers.dev/api/data"
#API_TOKEN = "secret" # Replace with your actual secret
LOCAL_DB_NAME = "satellite_mirror.db"

# Optional Filters (Set to None if not needed)
DEVICE_FILTER = None  # Example: "test-001"
START_DATE = None     # Example: "2026-04-01"

def setup_local_db():
    """Creates the local database and table if they don't exist."""
    conn = sqlite3.connect(LOCAL_DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS local_cloudloop_data (
            remote_id INTEGER,
            raw_payload TEXT,
            received_at TEXT,
            synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(remote_id) 
        )
    ''')
    conn.commit()
    return conn

def fetch_remote_data():
    """Pulls data from your Cloudflare Worker API."""
    params = {
        "token": API_TOKEN,
        "device_id": DEVICE_FILTER,
        "start_date": START_DATE
    }
    
    print(f"Fetching data from {API_URL}...")
    try:
        response = requests.get(API_URL, params=params)
        response.raise_for_status() # Error if not 200 OK
        return response.json()
    except Exception as e:
        print(f"Error fetching data: {e}")
        return []

def sync():
    conn = setup_local_db()
    cursor = conn.cursor()
    
    remote_data = fetch_remote_data()
    new_records_count = 0

    for record in remote_data:
        try:
            # We use 'INSERT OR IGNORE' so if remote_id already exists, it skips it
            cursor.execute('''
                INSERT OR IGNORE INTO local_cloudloop_data (remote_id, raw_payload, received_at)
                VALUES (?, ?, ?)
            ''', (record['id'], record['raw_payload'], record['received_at']))
            
            if conn.total_changes > 0:
                # If a row was actually added
                new_records_count += (1 if cursor.rowcount > 0 else 0)
        except Exception as e:
            print(f"Error inserting record {record.get('id')}: {e}")

    conn.commit()
    conn.close()
    print(f"Sync complete. Added {new_records_count} new records to {LOCAL_DB_NAME}.")

if __name__ == "__main__":
    sync()
