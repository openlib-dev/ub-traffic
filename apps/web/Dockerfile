FROM node:22-bookworm-slim AS build

WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY tools/osm/package.json tools/osm/package.json
RUN npm ci
COPY apps/web apps/web
COPY tools/osm tools/osm

ARG VITE_SIMULATION_URL=/api
ARG VITE_OVERPASS_URL
ARG VITE_OVERPASS_FALLBACK_URL
ARG VITE_NOMINATIM_URL
ARG VITE_SATELLITE_TILE_URL
ENV VITE_SIMULATION_URL=$VITE_SIMULATION_URL \
    VITE_OVERPASS_URL=$VITE_OVERPASS_URL \
    VITE_OVERPASS_FALLBACK_URL=$VITE_OVERPASS_FALLBACK_URL \
    VITE_NOMINATIM_URL=$VITE_NOMINATIM_URL \
    VITE_SATELLITE_TILE_URL=$VITE_SATELLITE_TILE_URL

RUN npm run build -w @ub/web

FROM nginx:1.27-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/apps/web/dist /usr/share/nginx/html

EXPOSE 80
