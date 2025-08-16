# GitHub Actions Workflows

Este directorio contiene los workflows de GitHub Actions para el proyecto `agent-communication-mcp`.

## Workflows Disponibles

### 1. CI Tests (`ci-tests.yml`)

**Propósito**: Ejecuta pruebas de integración continua para todas las ramas principales.

**Triggers**:
- Push a `feature/docker`, `main`, `develop`
- Pull requests a `main`, `develop`, `feature/docker`

**Jobs**:
- **Unit Tests**: Pruebas unitarias y verificación de tipos TypeScript
- **Integration Tests**: Pruebas de integración y construcción del proyecto
- **Docker Validation**: Validación de la imagen Docker
- **Security Audit**: Auditoría de seguridad y verificación de calidad
- **ZK Proofs Validation**: Validación de pruebas de conocimiento cero
- **Full Integration Test**: Prueba completa de integración (solo para `feature/docker`)
- **Test Report**: Generación de reportes y artefactos

**Características**:
- Soporte para Node.js 20.x y 22.x
- Cache optimizado para Yarn
- Cobertura de código con Codecov
- Validación de Docker
- Verificación de pruebas ZK

### 2. Docker Tests (`docker-tests.yml`)

**Propósito**: Pruebas específicas de Docker para la rama `feature/docker`.

**Triggers**:
- Push a `feature/docker`
- Pull requests a `feature/docker`

**Jobs**:
- **Docker Build & Test**: Construcción y pruebas básicas de Docker
- **Docker Performance Test**: Pruebas de rendimiento y métricas

**Características**:
- Validación completa de la imagen Docker
- Pruebas de ciclo de vida del contenedor
- Métricas de rendimiento
- Verificación de artefactos Docker

## Configuración de Yarn

Este proyecto utiliza **Yarn** como package manager. Los workflows están optimizados para:

- **Cache**: Uso del cache de Yarn para acelerar las instalaciones
- **Instalación**: `yarn install --frozen-lockfile --prefer-offline`
- **Scripts**: Todos los comandos usan `yarn` en lugar de `npm`

## Scripts Disponibles

Los workflows utilizan los siguientes scripts del `package.json`:

- `yarn build`: Construcción del proyecto
- `yarn test`: Ejecución de pruebas unitarias
- `yarn test:coverage`: Pruebas con cobertura
- `yarn test:file`: Pruebas de archivos específicos
- `yarn lint`: Verificación de linting
- `yarn tsc`: Verificación de tipos TypeScript
- `yarn keys:generate`: Generación de claves
- `yarn setup:agent`: Configuración de agente

## Requisitos del Sistema

- **Node.js**: Versiones 20.x y 22.x
- **Yarn**: Versión 1.22.22 (especificada en package.json)
- **Docker**: Para validación de contenedores
- **Ubuntu**: Los workflows se ejecutan en `ubuntu-latest`

## Artefactos Generados

Los workflows generan y almacenan los siguientes artefactos:

- **Test Results**: Resultados de pruebas y cobertura
- **Docker Artifacts**: Dockerfile, .dockerignore, docker-compose
- **Build Outputs**: Archivos compilados y distribuidos
- **Logs**: Logs de ejecución y errores

## Configuración de Cache

Se utiliza el cache de Yarn para optimizar las instalaciones:

```yaml
- name: Setup Node.js ${{ matrix.node-version }}
  uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node-version }}
    cache: 'yarn'
```

## Monitoreo y Reportes

- **GitHub Step Summary**: Reportes detallados en la interfaz de GitHub
- **Codecov**: Cobertura de código
- **Artefactos**: Descarga de resultados y logs
- **Notificaciones**: Estado de ejecución en pull requests

## Solución de Problemas

### Problemas Comunes

1. **Fallos de TypeScript**: Verificar que `yarn tsc` esté disponible
2. **Errores de Docker**: Verificar permisos y configuración de Docker
3. **Fallos de Yarn**: Verificar versión de Yarn y lockfile
4. **Problemas de ZK**: Verificar estructura de directorios de pruebas ZK

### Debugging

- Revisar logs completos en GitHub Actions
- Verificar artefactos generados
- Comprobar configuración de Node.js y Yarn
- Validar estructura del proyecto

## Personalización

Para personalizar los workflows:

1. Modificar triggers en la sección `on:`
2. Ajustar versiones de Node.js en `strategy.matrix`
3. Agregar nuevos jobs según necesidades
4. Modificar timeouts y recursos según requerimientos

## Contribución

Al modificar los workflows:

1. Probar cambios en ramas de feature
2. Verificar compatibilidad con Yarn
3. Mantener consistencia con otros repos del proyecto
4. Documentar cambios en este README
