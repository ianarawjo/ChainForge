# ChainForge Docker Setup

This document describes how to run ChainForge using Docker in both development and production environments.

## Prerequisites

- Docker (version 20.10 or later)
- Docker Compose (version 2.0 or later)

## Production Setup

### Using Docker Compose (Recommended)

Build and run ChainForge in production mode:

```bash
docker-compose up -d
```

This will:
- Build the production image with the optimized multi-stage build
- Start the ChainForge server on port 8000
- Create a persistent volume for user data
- Restart automatically if the container crashes

Access ChainForge at: http://localhost:8000

### Using Docker CLI

Build the production image:

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

## Development Setup

### Using Docker Compose (Recommended)

For development with hot-reloading:

```bash
docker-compose -f docker-compose.dev.yml up
```

This will:
- Build the development image with all dev dependencies
- Start the React dev server on port 3000
- Start the Python backend on port 8000
- Mount your source code for hot-reloading
- Enable file watching with polling (works better in Docker)

Access the development server at: http://localhost:3000

### Using Docker CLI

Build the development image:

```bash
docker build -f Dockerfile.dev -t chainforge:dev .
```

Run the container with volume mounts:

```bash
docker run -it \
  -p 3000:3000 \
  -p 8000:8000 \
  -v $(pwd)/chainforge/react-server:/app \
  -v $(pwd)/chainforge:/chainforge/chainforge \
  -v /app/node_modules \
  -e CHOKIDAR_USEPOLLING=true \
  --name chainforge-dev \
  chainforge:dev
```

## Managing Containers

### View logs

```bash
# Production
docker-compose logs -f

# Development
docker-compose -f docker-compose.dev.yml logs -f
```

### Stop containers

```bash
# Production
docker-compose down

# Development
docker-compose -f docker-compose.dev.yml down
```

### Rebuild images

```bash
# Production
docker-compose build --no-cache

# Development
docker-compose -f docker-compose.dev.yml build --no-cache
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

### Production Image (Dockerfile)

Multi-stage build optimized for size:

1. **Stage 1**: Build React frontend with all dependencies
2. **Stage 2**: Build Python dependencies
3. **Stage 3**: Create minimal runtime image with only necessary files

### Development Image (Dockerfile.dev)

Single-stage build with:
- All dev dependencies for hot-reloading
- Both Node.js and Python environments
- Volume mounts for live code updates

## Troubleshooting

### ESLint Config Error

If you see "ESLint couldn't find the config 'semistandard'":
- This is fixed in the current Dockerfile by installing devDependencies
- Rebuild the image: `docker-compose build --no-cache`

### Port Already in Use

If ports 3000 or 8000 are already in use:
- Change the port mapping in `docker-compose.yml` or `docker-compose.dev.yml`
- Example: `"3001:3000"` to use port 3001 on your host

### File Changes Not Reflected (Development)

If hot-reloading isn't working:
- Ensure `CHOKIDAR_USEPOLLING=true` is set
- Check that volumes are properly mounted
- Try restarting the development container

### Permission Issues

If you encounter permission errors:
- The production image runs as a non-root user (uid 1000)
- Ensure your volume permissions match this user
- You can adjust the UID in the Dockerfile if needed

## Performance Tips

### Production

- Use the multi-stage build (default Dockerfile)
- The image is optimized to be under 1GB
- Unnecessary files and caches are cleaned during build

### Development

- Keep `node_modules` in a named volume (don't mount from host)
- Use polling for file watching in Docker (`CHOKIDAR_USEPOLLING=true`)
- Consider allocating more memory to Docker if builds are slow

## Pushing to Registry

To push the production image to a registry:

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
