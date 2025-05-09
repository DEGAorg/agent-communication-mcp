import { McpError, ErrorCode, Resource } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./logger.js";
import { ALL_TOOLS } from "./tools.js";

/**
 * Define the default agent communication resource
 */
export const DEFAULT_AGENT_RESOURCE: Resource = {
  uri: "agent://info",
  name: "Agent Communication Information",
  description: "Basic information about agent communication capabilities and available services",
  mimeType: "application/json"
};

/**
 * Define services list resource
 */
export const SERVICES_LIST_RESOURCE: Resource = {
  uri: "agent://services",
  name: "Available Services",
  description: "List of all registered services in the system",
  mimeType: "application/json"
};

/**
 * Define service registration resource
 */
export const SERVICE_REGISTRATION_RESOURCE: Resource = {
  uri: "agent://service-registration",
  name: "Service Registration",
  description: "Resource for registering new services in the system",
  mimeType: "application/json"
};

/**
 * Define service payment resource
 */
export const SERVICE_PAYMENT_RESOURCE: Resource = {
  uri: "agent://service-payment",
  name: "Service Payment",
  description: "Resource for handling service payments",
  mimeType: "application/json"
};

/**
 * Define service delivery resource
 */
export const SERVICE_DELIVERY_RESOURCE: Resource = {
  uri: "agent://service-delivery",
  name: "Service Delivery",
  description: "Resource for delivering service data",
  mimeType: "application/json"
};

/**
 * Define data revelation resource
 */
export const DATA_REVELATION_RESOURCE: Resource = {
  uri: "agent://data-revelation",
  name: "Data Revelation",
  description: "Resource for revealing encrypted data",
  mimeType: "application/json"
};

/**
 * Define available tools resource
 */
export const AVAILABLE_TOOLS_RESOURCE: Resource = {
  uri: "agent://available-tools",
  name: "Available Tools",
  description: "List of available tools for agent communication",
  mimeType: "application/json"
};

/**
 * List of all available resources
 */
export const RESOURCES = [
  DEFAULT_AGENT_RESOURCE,
  SERVICES_LIST_RESOURCE,
  SERVICE_REGISTRATION_RESOURCE,
  SERVICE_PAYMENT_RESOURCE,
  SERVICE_DELIVERY_RESOURCE,
  DATA_REVELATION_RESOURCE,
  AVAILABLE_TOOLS_RESOURCE
];

/**
 * Handle list resources request
 */
export function handleListResources(): Resource[] {
  logger.info("Handling list resources request");
  return RESOURCES;
}

/**
 * Handle read resource request
 * @param resourceUri The resource URI to read
 * @returns The resource metadata and content
 */
export function handleReadResource(resourceUri: string): Resource {
  logger.info(`Handling read resource request for ${resourceUri}`);
  
  const resource = RESOURCES.find((r) => r.uri === resourceUri);
  
  if (!resource) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Resource not found: ${resourceUri}`
    );
  }

  // Add tool information to the available tools resource
  if (resourceUri === AVAILABLE_TOOLS_RESOURCE.uri) {
    return {
      ...resource,
      content: JSON.stringify(ALL_TOOLS)
    };
  }
  
  return resource;
} 