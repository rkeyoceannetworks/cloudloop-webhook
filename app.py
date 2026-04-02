from flask import Flask, render_template, request
import sqlite3
import json

app = Flask(__name__)
DB_NAME = "satellite_mirror.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row  # This allows us to access columns by name
    return conn

@app.route('/')
def index():
    device_filter = request.args.get('device_id', '')
    conn = get_db_connection()
    
    query = "SELECT * FROM local_cloudloop_data"
    params = []
    
    if device_filter:
        query += " WHERE raw_payload LIKE ?"
        params.append(f'%{device_filter}%')
    
    query += " ORDER BY received_at DESC"
    
    rows = conn.execute(query, params).fetchall()
    conn.close()
    
    return render_template('index.html', rows=rows, device_filter=device_filter)

if __name__ == '__main__':
    # Listen on all network interfaces (0.0.0.0) so you can access it 
    # from your laptop's browser using the Debian IP address.
    app.run(host='0.0.0.0', port=5000, debug=True)
