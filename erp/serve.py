"""
Production server entry point for Windows LAN deployment.
Uses Waitress as the WSGI server (Windows-compatible).

Usage:
    python serve.py
"""
import os
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erp.settings')

from waitress import serve
from erp.wsgi import application

# Force unbuffered output for real-time logging
sys.stdout = open(sys.stdout.fileno(), mode='w', buffering=1)
sys.stderr = open(sys.stderr.fileno(), mode='w', buffering=1)

HOST = '0.0.0.0'   # Listen on all network interfaces (LAN accessible)
PORT = 8000

if __name__ == '__main__':
    print(f"\n{'='*55}")
    print(f"  EliteERP Production Server")
    print(f"  Listening on : http://0.0.0.0:{PORT}")
    print(f"  LAN URL      : http://192.168.1.2:{PORT}")
    print(f"  Press Ctrl+C to stop")
    print(f"{'='*55}\n", flush=True)
    serve(application, host=HOST, port=PORT, threads=8)

