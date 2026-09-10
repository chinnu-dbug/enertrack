import sys
import os

# Ensure project root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app import app as flask_app

class VercelRewritesFix:
    """WSGI middleware to restore original request URI from Vercel rewrite headers."""
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        path = environ.get('PATH_INFO', '')
        if path in ('/api/index', '/api/index.py', '/api', '/api/'):
            forwarded_uri = (
                environ.get('HTTP_X_FORWARDED_URI') or 
                environ.get('HTTP_X_VERCEL_FORWARDED_URI') or 
                environ.get('HTTP_X_MATCHED_PATH') or 
                '/'
            )
            orig_path = forwarded_uri.split('?')[0]
            environ['PATH_INFO'] = orig_path if orig_path else '/'
        return self.wsgi_app(environ, start_response)

# Vercel entrypoint
app = VercelRewritesFix(flask_app)
