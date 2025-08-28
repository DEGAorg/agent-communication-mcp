# GitHub Actions Workflows

This directory contains the GitHub Actions workflows for the `agent-communication-mcp` project.

## Available Workflows

### 1. CI Tests (`ci-tests.yml`)

**Purpose**: Runs continuous integration tests for all main branches.

**Triggers**:
- Push to `feature/docker`, `main`, `develop`
- Pull requests to `main`, `develop`, `feature/docker`

**Jobs**:
- **Unit Tests**: Unit tests and TypeScript type checking
- **Integration Tests**: Integration tests and project building
- **Docker Validation**: Docker image validation
- **Security Audit**: Security audit and quality verification
- **ZK Proofs Validation**: Zero-knowledge proofs validation
- **Full Integration Test**: Complete integration test (only for `feature/docker`)
- **Test Report**: Report generation and artifacts

**Features**:
- Support for Node.js 20.x and 22.x
- Optimized cache for Yarn
- Code coverage with Codecov
- Docker validation
- ZK proofs verification

### 2. Docker Tests (`docker-tests.yml`)

**Purpose**: Docker-specific tests for the `feature/docker` branch.

**Triggers**:
- Push to `feature/docker`
- Pull requests to `feature/docker`

**Jobs**:
- **Docker Build & Test**: Docker build and basic tests
- **Docker Performance Test**: Performance tests and metrics

**Features**:
- Complete Docker image validation
- Container lifecycle tests
- Performance metrics
- Docker artifacts verification

## Yarn Configuration

This project uses **Yarn** as the package manager. The workflows are optimized for:

- **Cache**: Use of Yarn cache to speed up installations
- **Installation**: `yarn install --frozen-lockfile --prefer-offline`
- **Scripts**: All commands use `yarn` instead of `npm`

## Available Scripts

The workflows use the following scripts from `package.json`:

- `yarn build`: Project building
- `yarn test`: Unit test execution
- `yarn test:coverage`: Tests with coverage
- `yarn test:file`: Tests for specific files
- `yarn lint`: Linting verification
- `yarn tsc`: TypeScript type checking
- `yarn keys:generate`: Key generation
- `yarn setup:agent`: Agent setup

## System Requirements

- **Node.js**: Versions 20.x and 22.x
- **Yarn**: Version 1.22.22 (specified in package.json)
- **Docker**: For container validation
- **Ubuntu**: Workflows run on `ubuntu-latest`

## Generated Artifacts

The workflows generate and store the following artifacts:

- **Test Results**: Test results and coverage
- **Docker Artifacts**: Dockerfile, .dockerignore, docker-compose
- **Build Outputs**: Compiled and distributed files
- **Logs**: Execution logs and errors

## Cache Configuration

Yarn cache is used to optimize installations:

```yaml
- name: Setup Node.js ${{ matrix.node-version }}
  uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node-version }}
    cache: 'yarn'
```

## Monitoring and Reports

- **GitHub Step Summary**: Detailed reports in GitHub interface
- **Codecov**: Code coverage
- **Artifacts**: Download of results and logs
- **Notifications**: Execution status in pull requests

## Troubleshooting

### Common Issues

1. **TypeScript Failures**: Verify that `yarn tsc` is available
2. **Docker Errors**: Verify Docker permissions and configuration
3. **Yarn Failures**: Verify Yarn version and lockfile
4. **ZK Issues**: Verify ZK test directory structure

### Debugging

- Review complete logs in GitHub Actions
- Verify generated artifacts
- Check Node.js and Yarn configuration
- Validate project structure

## Customization

To customize the workflows:

1. Modify triggers in the `on:` section
2. Adjust Node.js versions in `strategy.matrix`
3. Add new jobs as needed
4. Modify timeouts and resources according to requirements

## Contribution

When modifying the workflows:

1. Test changes in feature branches
2. Verify Yarn compatibility
3. Maintain consistency with other project repos
4. Document changes in this README
