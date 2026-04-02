from flask import Flask, render_template, request
import sqlite3

app = Flask(__name__)
DB_NAME = "satellite_mirror.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row 
    return conn

@app.route('/')
def index():
    conn = get_db_connection()
    
    # We are 'plucking' specific fields out of the raw_payload string
    query = """
        SELECT 
            rowid, 
            remote_id, 
            received_at,
            json_extract(raw_payload, '$.device_id') as device,
            json_extract(raw_payload, '$.status') as status,
            json_extract(raw_payload, '$.message') as message
        FROM local_cloudloop_data 
        ORDER BY received_at DESC
    """
    
    rows = conn.execute(query).fetchall()
    conn.close()
    
    return render_template('index.html', rows=rows)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
