# ChainForge Docker Setup

This document describes how to run ChainForge using Docker. ChainForge provides two Docker image variants:

- **CPU (latest)**: Optimized for CPU-only environments with dependency constraints
- **GPU**: Supports GPU acceleration without dependency constraints

## Prerequisites

- Docker (version 20.10 or later)
- Docker Compose (version 2.0 or later)
- For GPU: NVIDIA Docker runtime (nvidia-docker2)

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
- Uses `constraints.txt` for dependency version pinning
- Optimized for CPU-only environments
- Smaller image size
- Compatible with all platforms (amd64, arm64)
- Tagged as: `latest`, `cpu`

### GPU
- Does NOT use `constraints.txt` for maximum GPU compatibility
- Supports NVIDIA GPU acceleration
- Larger image size due to GPU-enabled dependencies
- Requires NVIDIA Docker runtime
- Tagged as: `gpu`

**When to use GPU variant:**
- You have NVIDIA GPUs available
- You need GPU acceleration for ML/AI workloads
- You want the latest versions of GPU-enabled packages

**When to use CPU variant:**
- Running on CPU-only machines
- Deploying to cloud platforms without GPU
- Want stable, version-pinned dependencies

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

Multi-stage build optimized for size:

1. **Stage 1**: Build React frontend with all dependencies
2. **Stage 2**: Build Python dependencies (with/without constraints)
3. **Stage 3**: Create minimal runtime image with only necessary files

## Automated Builds (CI/CD)

Docker images are automatically built and pushed to Docker Hub via GitHub Actions when:

- A pull request is created (images are built but not pushed)
- Code is pushed to main/master branch
- A version tag is created (e.g., `v1.0.0`)

### GitHub Actions Workflow

The workflow builds both CPU and GPU variants:

**CPU Image Tags:**
- `latest` - Always points to the latest CPU build
- `cpu` - Explicit CPU tag
- `main` / `master` - Branch-specific tags
- `v1.0.0`, `v1.0` - Version tags (on release)

**GPU Image Tags:**
- `gpu` - Latest GPU build
- `main-gpu` / `master-gpu` - Branch-specific GPU tags
- `v1.0.0-gpu`, `v1.0-gpu` - Version GPU tags (on release)

### Required GitHub Secrets

To enable automated image publishing, configure these secrets in your GitHub repository:

- `DOCKER_USERNAME` - Your Docker Hub username
- `DOCKER_PASSWORD` - Your Docker Hub password or access token

Navigate to: `Settings > Secrets and variables > Actions > New repository secret`

### Workflow Optimizations

The workflow includes several optimizations to prevent unnecessary builds:

1. **Path Filters**: Only triggers when Docker-related files change (Dockerfiles, chainforge/, setup.py, etc.)
2. **Concurrency Control**: Automatically cancels in-progress builds when a new one starts
3. **Skip CI**: Add `[skip ci]` or `[ci skip]` to your commit message to skip the build

Example:
```bash
git commit -m "Update README [skip ci]"
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
