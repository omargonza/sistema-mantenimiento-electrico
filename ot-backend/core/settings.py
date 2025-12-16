from pathlib import Path
import os

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# =========================================================
#  FLAGS / ENV
# =========================================================
# En Render: setear DJANGO_SECRET_KEY, DJANGO_DEBUG=False
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-key")
DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() == "true"

# En Render: ALLOWED_HOSTS=tu-backend.onrender.com
_allowed = os.getenv("ALLOWED_HOSTS", "*" if DEBUG else "")
ALLOWED_HOSTS = [h.strip() for h in _allowed.split(",") if h.strip()]

# =========================================================
#  APPS
# =========================================================
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # API
    "rest_framework",
    "corsheaders",

    # App
    "orders",
]

# =========================================================
#  MIDDLEWARE
# =========================================================
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",

    # Static en producción (Render) sin servidor extra
    "whitenoise.middleware.WhiteNoiseMiddleware",

    # CORS primero
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",

    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"

# =========================================================
#  TEMPLATES / WSGI
# =========================================================
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "core.wsgi.application"

# =========================================================
#  DATABASE
# =========================================================
# En Render ponés DATABASE_URL (Neon/Supabase/etc).
# Si no existe, usa sqlite (dev).
DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            ssl_require=True,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# =========================================================
#  CORS / CSRF
# =========================================================
# En producción NO uses allow all.
# En Render seteás:
#   CORS_ALLOWED_ORIGINS=https://tu-frontend.onrender.com
#   CSRF_TRUSTED_ORIGINS=https://tu-frontend.onrender.com
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
    CORS_ALLOW_CREDENTIALS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOW_CREDENTIALS = True

    cors_env = os.getenv("CORS_ALLOWED_ORIGINS", "")
    CORS_ALLOWED_ORIGINS = [x.strip() for x in cors_env.split(",") if x.strip()]

csrf_env = os.getenv("CSRF_TRUSTED_ORIGINS", "")
CSRF_TRUSTED_ORIGINS = [x.strip() for x in csrf_env.split(",") if x.strip()]

CORS_ALLOW_METHODS = [
    "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"
]

CORS_ALLOW_HEADERS = [
    "content-type",
    "authorization",
    "accept",
    "origin",
    "x-requested-with",
]

# =========================================================
#  STATIC / MEDIA
# =========================================================
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# WhiteNoise storage (cache + hashes)
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    }
}

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# =========================================================
#  SECURITY (PROD)
# =========================================================
if not DEBUG:
    # Render está detrás de proxy HTTPS
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# =========================================================
#  DEFAULTS
# =========================================================
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
