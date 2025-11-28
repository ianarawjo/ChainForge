# ChainForge Docker Setup

This document describes how to run ChainForge using Docker. ChainForge provides two Docker image variants:

- **CPU (latest)**: Multi-architecture (AMD64 + ARM64) optimized for CPU-only environments
- **GPU**: AMD64-only with CUDA support for GPU acceleration

## Prerequisites

- Docker (version 20.10 or later)
- Docker Compose (version 2.0 or later)
- For GPU: NVIDIA Docker runtime (nvidia-docker2)

## Architecture Support

**CPU Images**: Available for both AMD64 and ARM64 architectures. Docker automatically pulls the correct architecture for your system.

**GPU Images**: AMD64 only (ARM64 GPU support is limited and CUDA packages are very large)

## Quick Start

### CPU Version (Default)

Using Docker Compose (Recommended):

```bash
docker-compose up -d
```

Or using Docker CLI:

```bash
# Pull pre-built image
docker pull gauransh/chainforge:latest

# Or build locally
docker build -t chainforge:cpu .

# Run
docker run -d \
  -p 8000:8000 \
  -v chainforge-data:/home/chainforge/.local/share/chainforge \
  --name chainforge \
  --restart unless-stopped \
  gauransh/chainforge:latest
```

### GPU Version

Using Docker Compose (Recommended):

```bash
docker-compose -f docker-compose.gpu.yml up -d
```

Or using Docker CLI:

```bash
# Pull pre-built image
docker pull gauransh/chainforge:gpu

# Or build locally
docker build -f Dockerfile.gpu -t chainforge:gpu .

# Run with GPU support
docker run -d \
  -p 8000:8000 \
  -v chainforge-data:/home/chainforge/.local/share/chainforge \
  --name chainforge-gpu \
  --gpus all \
  --restart unless-stopped \
  gauransh/chainforge:gpu
```

Access ChainForge at: http://localhost:8000

## Image Variants

### CPU (latest)
- **Architectures**: AMD64, ARM64 (multi-arch manifest)
- **Size**: Optimized and minimal (~800MB compressed)
- **Dependencies**: Uses `constraints.txt` for version pinning
- **PyTorch**: CPU-only build from https://download.pytorch.org/whl/cpu
- **Tags**: `latest`, `cpu`, branch names (e.g., `main`, `ragforge`), version tags (e.g., `v1.0`, `1.0`)

### GPU
- **Architecture**: AMD64 only
- **Size**: Larger due to CUDA support (~2-3GB compressed)
- **Dependencies**: Uses `constraints.txt` for version pinning
- **PyTorch**: CUDA 12.1 build from https://download.pytorch.org/whl/cu121
- **Tags**: `gpu`, branch names with `-gpu` suffix (e.g., `main-gpu`, `ragforge-gpu`), version tags with `-gpu` suffix (e.g., `v1.0-gpu`, `1.0-gpu`)
- **Requirements**: NVIDIA GPU with CUDA support, nvidia-docker runtime

**When to use GPU variant:**
- You have NVIDIA GPUs available (AMD64 architecture)
- You need GPU acceleration for ML/AI workloads
- You're running compute-intensive models locally

**When to use CPU variant:**
- Running on CPU-only machines
- Using ARM64 devices (Apple Silicon, Raspberry Pi, etc.)
- Deploying to cloud platforms without GPU
- Smaller image size is preferred

## Managing Containers

### View logs

```bash
# CPU version
docker-compose logs -f

# GPU version
docker-compose -f docker-compose.gpu.yml logs -f
```

### Stop containers

```bash
# CPU version
docker-compose down

# GPU version
docker-compose -f docker-compose.gpu.yml down
```

### Rebuild images

```bash
# CPU version
docker-compose build --no-cache

# GPU version
docker-compose -f docker-compose.gpu.yml build --no-cache
```

### Remove volumes (delete all data)

```bash
docker-compose down -v
```

## Environment Variables

You can set API keys and other environment variables by:

1. Creating a `.env` file in the project root
2. Adding your variables (they're already templated in docker-compose.yml):

```env
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
COHERE_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
DEEPSEEK_API_KEY=your_key_here
HUGGINGFACE_API_KEY=your_key_here
```

3. Uncommenting the relevant lines in `docker-compose.yml`

## Docker Image Structure

Multi-stage build optimized for minimal size and fast builds:

### Stage 1: Frontend Builder
- Starts from `node:20-slim`
- Installs npm dependencies and builds React frontend
- Cleans up node_modules and npm cache after build
- Only the `/build` directory is copied to final image

### Stage 2: Python Builder
- Starts from `python:3.12-slim`
- Installs build dependencies (build-essential, git)
- Installs PyTorch (CPU or CUDA variant)
- Installs Python dependencies from `requirements.txt` with `constraints.txt`
- Installs ChainForge package
- Purges build tools and cleans caches

### Stage 3: Runtime Image
- Minimal `python:3.12-slim` base
- Only runtime dependencies: git, libgomp1
- Copies Python packages from builder
- Copies React build from frontend builder
- Aggressive cleanup of unnecessary files (tests, docs, cache, static libs)
- Runs as non-root user (chainforge, uid 1000)

**Optimizations:**
- Multi-stage build keeps final image small
- No build tools in runtime image
- All RUN commands combined into single layers to minimize layer count
- Aggressive file cleanup reduces image size by ~30%

## Automated Builds (CI/CD)

Docker images are automatically built and pushed to Docker Hub via GitHub Actions.

### Build Triggers

Builds run on:
- **Pull Requests**: Builds are tested but NOT pushed to Docker Hub
- **Branch Pushes**: `main`, `master`, `ragforge` - Built and pushed with branch-specific tags
- **Version Tags**: `v*` (e.g., `v1.0.0`) - Built and pushed with version tags

### Build Architecture

The workflow uses a **parallel multi-architecture build strategy**:

1. **3 Parallel Build Jobs**:
   - `build-cpu-amd64`: Builds CPU variant for AMD64
   - `build-cpu-arm64`: Builds CPU variant for ARM64
   - `build-gpu-amd64`: Builds GPU variant for AMD64 (with aggressive disk cleanup)

2. **Manifest Creation Jobs**:
   - `create-cpu-manifest`: Combines AMD64 + ARM64 into multi-arch CPU manifest
   - `create-gpu-manifest`: Creates GPU manifest (AMD64 only)

**Why separate builds?**
- **No QEMU emulation** - Native builds are 3-5x faster than cross-compilation
- **Parallel execution** - All architectures build simultaneously
- **Better caching** - Each architecture has independent build cache

### Available Tags

**CPU Images** (multi-arch: amd64 + arm64):
```
gauransh/chainforge:latest
gauransh/chainforge:cpu
gauransh/chainforge:main
gauransh/chainforge:ragforge
gauransh/chainforge:v1.0.0
gauransh/chainforge:1.0
```

**GPU Images** (amd64 only):
```
gauransh/chainforge:gpu
gauransh/chainforge:main-gpu
gauransh/chainforge:ragforge-gpu
gauransh/chainforge:v1.0.0-gpu
gauransh/chainforge:1.0-gpu
```

### Storage Optimizations

To prevent hitting GitHub Actions storage limits:

1. **No GitHub Actions cache** - Eliminated cache storage overhead
2. **No ARM64 GPU builds** - GPU only builds for AMD64 (50% storage reduction)
3. **Disabled provenance and SBOM** - Reduces metadata size
4. **Aggressive runner cleanup** - GPU builds free ~30-40GB before starting by removing:
   - .NET SDK, Android tools, GHC, CodeQL
   - LLVM, PHP, MongoDB, MySQL
   - Chrome, Firefox, Azure CLI, Google Cloud SDK
5. **Minimal Dockerfile** - All operations combined into single layers

### Concurrency Control

The workflow uses concurrency groups to automatically cancel in-progress builds when a new commit is pushed to the same branch:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### Skip CI

To skip Docker builds entirely, add `[skip ci]` or `[ci skip]` to your commit message:

```bash
git commit -m "Update documentation [skip ci]"
git commit -m "Fix typo [ci skip]"
```

This prevents all build jobs from running, saving time and resources.

### GitHub Secrets Required

To enable automated image publishing, configure these secrets:

- `DOCKER_USERNAME` - Docker Hub username
- `DOCKER_PASSWORD` - Docker Hub password or personal access token

**Setup**: Repository Settings → Secrets and variables → Actions → New repository secret

### Build Workflow Summary

```
┌─────────────────────────────────────────────────────────┐
│                    PR or Push Event                     │
└─────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │   Concurrency Check   │
                │ (Cancel old builds?)  │
                └───────────┬───────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ CPU AMD64    │   │ CPU ARM64    │   │ GPU AMD64    │
│ Build        │   │ Build        │   │ Build        │
│              │   │              │   │ (w/ cleanup) │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       │ upload digest    │ upload digest    │ upload digest
       │                  │                  │
       └────────┬─────────┴──────────────────┘
                │
      ┌─────────┴──────────┐
      │                    │
      ▼                    ▼
┌─────────────┐    ┌─────────────┐
│ CPU         │    │ GPU         │
│ Manifest    │    │ Manifest    │
│ (amd64+arm64)│   │ (amd64 only)│
└─────────────┘    └─────────────┘
      │                    │
      └─────────┬──────────┘
                │
                ▼
        Push to Docker Hub
```

## Troubleshooting

### ESLint Config Error

If you see "ESLint couldn't find the config 'semistandard'":
- This is fixed in the current Dockerfile by installing devDependencies
- Rebuild the image: `docker-compose build --no-cache`

### Port Already in Use

If port 8000 is already in use:
- Change the port mapping in `docker-compose.yml`
- Example: `"8080:8000"` to use port 8080 on your host

### Permission Issues

If you encounter permission errors:
- The image runs as a non-root user (uid 1000)
- Ensure your volume permissions match this user
- You can adjust the UID in the Dockerfile if needed

## Performance Tips

- The multi-stage build creates an optimized image
- The image is optimized to be under 1GB
- Unnecessary files and caches are cleaned during build
- Consider allocating more memory to Docker if builds are slow

## Pushing to Registry

To push the image to a registry:

```bash
# Tag the image
docker tag chainforge:latest your-registry/chainforge:tag

# Push to registry
docker push your-registry/chainforge:tag
```

Or let docker-compose handle it:

```bash
docker-compose build
docker-compose push
```
