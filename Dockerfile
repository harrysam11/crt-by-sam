# ==============================================================================
# CRT Institutional Terminal - Production Multi-Stage Dockerfile
# Stage 1: Build React/Vite Frontend
# Stage 2: Build Rust Axum/Tokio Server
# Stage 3: Minimal Production Runtime
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend SPA
# ------------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder
WORKDIR /app

# Copy root workspace and terminal package definitions
COPY package.json ./
COPY terminal/package*.json ./terminal/

RUN npm install --workspace=terminal

# Copy terminal source code
COPY terminal/ ./terminal/

# Build optimized production bundle
RUN npm --prefix terminal run build

# ------------------------------------------------------------------------------
# Stage 2: Build Rust Backend Binary
# ------------------------------------------------------------------------------
FROM rust:1.80-slim-bookworm AS backend-builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends pkg-config ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy Rust crate
COPY server/Cargo.toml server/Cargo.lock* ./server/
COPY server/src ./server/src

WORKDIR /app/server
RUN cargo build --release

# ------------------------------------------------------------------------------
# Stage 3: Minimal Production Container
# ------------------------------------------------------------------------------
FROM debian:bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Copy built binary from Stage 2
COPY --from=backend-builder /app/server/target/release/crt-server /app/crt-server

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/terminal/dist /app/terminal/dist

# Set production environment variables
ENV PORT=5173
ENV DIST_PATH=/app/terminal/dist
ENV RUST_LOG=info,crt_server=info

EXPOSE 5173

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5173/api/health || exit 1

ENTRYPOINT ["/app/crt-server"]
