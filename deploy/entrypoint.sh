#!/bin/sh
set -eu

if [ -z "${VITE_SUPABASE_URL:-}" ] || [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  echo "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set" >&2
  exit 1
fi

js_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > /usr/share/nginx/html/config.js <<EOF
window.__FEATURN_CONFIG__={VITE_SUPABASE_URL:"$(js_escape "$VITE_SUPABASE_URL")",VITE_SUPABASE_ANON_KEY:"$(js_escape "$VITE_SUPABASE_ANON_KEY")"};
EOF

exec nginx -g 'daemon off;'
