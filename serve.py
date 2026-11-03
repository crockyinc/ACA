import http.server
import functools

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass

if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=".")
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    server = http.server.ThreadingHTTPServer(("0.0.0.0", 8000), handler)
    print("Serving on 0.0.0.0:8000 with no-store")
    server.serve_forever()
