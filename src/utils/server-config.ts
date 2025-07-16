/**
 * Server configuration interface
 */
export interface ServerConfig {
  name: string;
  version: string;
  capabilities: {
    resources: Record<string, unknown>;
    tools: Record<string, unknown>;
    prompts: Record<string, unknown>;
  };
}

/**
 * Get the default server configuration
 * @returns Server configuration object
 */
export function getDefaultServerConfig(): ServerConfig {
  return {
    name: 'agent-communication-mcp-server',
    version: '1.0.0',
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  };
}

/**
 * Validate server configuration
 * @param config - The server configuration to validate
 * @returns True if the configuration is valid
 */
export function validateServerConfig(config: ServerConfig): boolean {
  return (
    typeof config.name === 'string' &&
    typeof config.version === 'string' &&
    typeof config.capabilities === 'object' &&
    config.capabilities !== null &&
    typeof config.capabilities.resources === 'object' &&
    typeof config.capabilities.tools === 'object' &&
    typeof config.capabilities.prompts === 'object'
  );
} 