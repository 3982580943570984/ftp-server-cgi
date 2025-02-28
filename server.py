#!/usr/bin/env python

import http.server
import socketserver

PORT = 80

handler = http.server.CGIHTTPRequestHandler


class TCPServer(socketserver.TCPServer):
    def server_bind(self):
        super().server_bind()
        self.server_name = "localhost"
        self.server_port = self.server_address[1]


with TCPServer(("", PORT), handler) as httpd:
    print(f"Serving CGI on port {PORT}")
    httpd.serve_forever()
