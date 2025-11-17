# ChainForge Docker Setup

This document describes how to run ChainForge using Docker.

## Prerequisites

- Docker (version 20.10 or later)
- Docker Compose (version 2.0 or later)

## Quick Start

### Using Docker Compose (Recommended)

Build and run ChainForge:

```bash
docker-compose up -d
```

This will:
- Build the optimized multi-stage Docker image
- Start the ChainForge server on port 8000
- Create a persistent volume for user data
- Restart automatically if the container crashes

Access ChainForge at: http://localhost:8000

### Using Docker CLI

Build the image:

```bash
docker build -t chainforge:latest .
```

Run the container:

```bash
docker run -d \
  -p 8000:8000 \
  -v chainforge-data:/home/chainforge/.local/share/chainforge \
  --name chainforge \
  --restart unless-stopped \
  chainforge:latest
```

## Managing Containers

### View logs

```bash
docker-compose logs -f
```

### Stop containers

```bash
docker-compose down
```

### Rebuild images

```bash
docker-compose build --no-cache
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
2. **Stage 2**: Build Python dependencies
3. **Stage 3**: Create minimal runtime image with only necessary files

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
