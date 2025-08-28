# Docker Testing Guide

## Overview

This project includes a Docker setup specifically designed for **testing purposes only**. The Docker container provides an isolated environment for running the test suite, making it ideal for CI/CD pipelines and ensuring consistent test execution across different environments.

**Important:** The Docker setup is **NOT** for running the actual MCP server. The server runs natively and is managed by ElizaOS.

## Purpose

- **Isolated Testing Environment**: Ensures tests run in a clean, consistent environment
- **CI/CD Integration**: Provides reliable test execution in automated pipelines
- **Dependency Management**: Handles all system dependencies automatically
- **Reproducible Results**: Same test results regardless of host environment

## Requirements

- Docker installed on your system
- At least 2GB of available disk space for the image

## Quick Start

### Build the Test Image

```bash
docker build -t agent-communication-mcp-test .
```

### Run Tests

```bash
# Run all tests
docker run --rm agent-communication-mcp-test

# Run tests with coverage
docker run --rm agent-communication-mcp-test yarn test:coverage

# Run specific test file
docker run --rm agent-communication-mcp-test yarn test:file test/prompt.test.ts
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Build and run tests
      run: |
        docker build -t agent-communication-mcp-test .
        docker run --rm agent-communication-mcp-test
```

### GitLab CI Example

```yaml
test:
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t agent-communication-mcp-test .
    - docker run --rm agent-communication-mcp-test
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any
    
    stages {
        stage('Test') {
            steps {
                sh 'docker build -t agent-communication-mcp-test .'
                sh 'docker run --rm agent-communication-mcp-test'
            }
        }
    }
}
```

## Exit Codes

The Docker container uses standard exit codes to communicate test results:

- **Exit Code 0**: All tests passed ✅
- **Exit Code 1**: Tests failed ❌
- **Exit Code 2**: Test execution error ⚠️

### Checking Exit Codes

```bash
# Run tests and check result
docker run --rm agent-communication-mcp-test
if [ $? -eq 0 ]; then
    echo "Tests PASSED"
else
    echo "Tests FAILED"
fi
```

## Environment Variables

The Docker container sets the following environment variables for testing:

- `NODE_ENV=test`
- `NODE_OPTIONS=--experimental-vm-modules`

## Test Coverage

To generate coverage reports in Docker:

```bash
# Run with coverage
docker run --rm agent-communication-mcp-test yarn test:coverage

# Mount volume to access coverage reports locally
docker run --rm -v $(pwd)/coverage:/app/coverage agent-communication-mcp-test yarn test:coverage
```

## Troubleshooting

### Common Issues

1. **Build Fails with Yarn Version Error**
   - The Dockerfile includes Corepack to handle Yarn 4.x
   - Ensure you're using the latest Dockerfile

2. **Tests Fail Due to Missing .env**
   - This is expected - tests use default configuration
   - Environment variables are handled by the test setup

3. **Permission Denied**
   - Ensure Docker has proper permissions
   - Run with appropriate user permissions if needed

### Debug Mode

To run tests with verbose output:

```bash
docker run --rm agent-communication-mcp-test yarn test --verbose
```

### Interactive Shell

To debug inside the container:

```bash
docker run --rm -it agent-communication-mcp-test /bin/sh
```

## Performance

- **Build Time**: ~30-60 seconds (first time)
- **Test Execution**: ~5-10 seconds
- **Image Size**: ~500MB (Alpine-based)

## Security

- Uses Alpine Linux for minimal attack surface
- Runs as non-root user when possible
- Includes only necessary dependencies
- No production secrets or credentials

## Limitations

- **Testing Only**: Not suitable for production deployment
- **No Persistence**: Container is ephemeral
- **No External Services**: Tests run in isolation
- **Limited Network Access**: Containerized environment

## Alternatives

For local development, you can still run tests directly:

```bash
# Local testing (recommended for development)
yarn test

# Local testing with coverage
yarn test:coverage
```

## Support

For issues with the Docker testing setup:

1. Check the troubleshooting section above
2. Verify Docker installation and permissions
3. Review the Dockerfile for any custom requirements
4. Check the test logs for specific error messages
