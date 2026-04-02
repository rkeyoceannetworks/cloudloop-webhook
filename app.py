import sqlite3
import csv
import io
from flask import Flask, render_template, request, Response

app = Flask(__name__)
DB_NAME = "satellite_mirror.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row 
    return conn

@app.route('/')
def index():
    conn = get_db_connection()
    # Pulling extracted fields for the web view
    query = """
        SELECT 
            rowid, remote_id, received_at,
            json_extract(raw_payload, '$.device_id') as device,
            json_extract(raw_payload, '$.status') as status,
            json_extract(raw_payload, '$.message') as message
        FROM local_cloudloop_data 
        ORDER BY received_at DESC
    """
    rows = conn.execute(query).fetchall()
    conn.close()
    return render_template('index.html', rows=rows)

@app.route('/export')
def export_csv():
    conn = get_db_connection()
    # We'll export the clean, extracted data for easy use in Excel
    query = """
        SELECT 
            received_at as Timestamp,
            json_extract(raw_payload, '$.device_id') as Device_ID,
            json_extract(raw_payload, '$.status') as Status,
            json_extract(raw_payload, '$.message') as Raw_Message
        FROM local_cloudloop_data 
        ORDER BY received_at DESC
    """
    cursor = conn.execute(query)
    
    # Create an in-memory string buffer to hold the CSV data
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write the Header row
    writer.writerow([column[0] for column in cursor.description])
    
    # Write the Data rows
    writer.writerows(cursor.fetchall())
    conn.close()

    # Create the response object
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=satellite_data_export.csv"}
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
