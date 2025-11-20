# Multi-stage build: Stage 1 - Build React frontend
FROM node:20-slim AS frontend-builder

WORKDIR /app

# Copy package files and install dependencies (including dev for build)
COPY chainforge/react-server/package*.json ./
RUN npm ci --legacy-peer-deps --prefer-offline

# Copy source files and build
COPY chainforge/react-server/ ./
RUN npm run build

# Stage 2 - Build Python dependencies (CPU version with constraints)
FROM python:3.12-slim AS python-builder

# Install only the build dependencies we need
RUN apt-get --allow-releaseinfo-change update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Upgrade pip tools first (this layer is highly cacheable)
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Copy requirements first for better layer caching
COPY chainforge/requirements.txt chainforge/constraints.txt ./

# Install PyTorch CPU-only FIRST as it's the largest dependency
# This separates the longest-running install into its own layer
RUN pip install --no-cache-dir --prefix=/install \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    torch torchvision torchaudio

# Install remaining requirements with constraints
# Using --find-links to help pip resolve faster
RUN pip install --no-cache-dir --prefix=/install \
    -r requirements.txt \
    -c constraints.txt

# Copy project files and build the package (smallest layer last)
COPY setup.py README.md ./
COPY chainforge/ ./chainforge/
RUN pip install --no-cache-dir --prefix=/install .

# Stage 3 - Final minimal runtime image
FROM python:3.12-slim

# Install only runtime dependencies (no build tools)
RUN apt-get --allow-releaseinfo-change update && \
    apt-get install -y --no-install-recommends \
    git \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /chainforge

# Copy Python packages from builder
COPY --from=python-builder /install /usr/local

# Copy the built React app from the frontend-builder stage to the installed package location
COPY --from=frontend-builder /app/build /usr/local/lib/python3.12/site-packages/chainforge/react-server/build

# Clean up any unnecessary files to reduce image size
RUN find /usr/local -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true && \
    find /usr/local -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true && \
    find /usr/local -name "*.pyc" -delete && \
    find /usr/local -name "*.pyo" -delete && \
    find /usr/local -name "*.md" -delete 2>/dev/null || true

# Run as non-root user for security
RUN useradd -m -u 1000 chainforge && \
    mkdir -p /home/chainforge/.local/share/chainforge && \
    chown -R chainforge:chainforge /chainforge /home/chainforge

USER chainforge

EXPOSE 8000

ENTRYPOINT [ "chainforge", "serve", "--host", "0.0.0.0" ]
