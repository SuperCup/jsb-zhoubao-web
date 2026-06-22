import http.server
import socketserver
import os

BASE_PATH = "/jsb-zhoubao-web"
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public-dist")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self):
        # Strip the base path prefix
        if self.path.startswith(BASE_PATH):
            self.path = self.path[len(BASE_PATH):]
            if self.path == "":
                self.path = "/"
        # If requesting root, serve index.html
        if self.path == "/":
            self.path = "/index.html"
        return super().do_GET()

PORT = 8004
with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Serving {STATIC_DIR} at http://0.0.0.0:{PORT}{BASE_PATH}/")
    httpd.serve_forever()
