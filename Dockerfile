# syntax=docker/dockerfile:1.7
# Static site (notes + UI) served by nginx — single image for Cloud Run / GKE / anywhere.

FROM nginx:1.27-alpine AS runtime

# Cloud Run sends $PORT (default 8080). We render nginx.conf with envsubst at start.
ENV PORT=8080

# Strip default config, install our template
RUN rm -f /etc/nginx/conf.d/default.conf

COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy the SPA (content lives inside site/content/)
WORKDIR /usr/share/nginx/html
COPY site/ ./site/

# Tiny landing redirect to /site/
RUN printf '<!doctype html><meta http-equiv="refresh" content="0; url=/site/">\n' > index.html

EXPOSE 8080
# nginx:alpine entrypoint runs envsubst over /etc/nginx/templates/*.template → /etc/nginx/conf.d/
CMD ["nginx", "-g", "daemon off;"]
