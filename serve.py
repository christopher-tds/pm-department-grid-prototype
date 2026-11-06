"""Local preview server with live reload. No dependencies.

    python3 serve.py            # http://localhost:5181
    python3 serve.py 5200       # another port

Serves this folder and pushes a reload to open pages whenever a file changes.
"""
import http.server
import os
import socketserver
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 5181))
WATCH = (".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp")


def snapshot():
    stamp = 0.0
    for folder, _, files in os.walk(ROOT):
        if "/." in folder:
            continue
        for name in files:
            if name.endswith(WATCH):
                try:
                    stamp = max(stamp, os.path.getmtime(os.path.join(folder, name)))
                except OSError:
                    pass
    return stamp


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path != "/__reload":
            return super().do_GET()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        last = snapshot()
        try:
            while True:
                time.sleep(0.4)
                now = snapshot()
                if now != last:
                    last = now
                    self.wfile.write(b"data: reload\n\n")
                else:
                    self.wfile.write(b": ping\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, fmt, *args):
        if "/__reload" not in (args[0] if args else ""):
            super().log_message(fmt, *args)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        print(f"Pedal Mafia PLP prototype: http://localhost:{PORT}/  (Ctrl+C to stop)", flush=True)
        httpd.serve_forever()
