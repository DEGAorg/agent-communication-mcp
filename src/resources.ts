import { McpError, ErrorCode, Resource } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./logger.js";
import { ALL_TOOLS } from "./tools.js";
import { AppError } from './errors/AppError.js';
import { handleError } from './errors/errorHandler.js';

/**
 * Define the default agent communication resource
 */
export const DEFAULT_AGENT_RESOURCE: Resource = {
  uri: "agent://info",
  name: "Agent Communication Information",
  description: "Core information about the agent's communication capabilities and state",
  mimeType: "application/json",
  content: JSON.stringify({
    capabilities: {
      marketplace: true,
      authentication: true,
      payment: true,
      content: true
    },
    state: {
      requires_authentication: true,
      requires_midnight_wallet: true
    }
  })
};

/**
 * Define services list resource
 */
export const SERVICES_LIST_RESOURCE: Resource = {
  uri: "agent://services",
  name: "Service Marketplace",
  description: "Browse and search the service marketplace. Filter services by topics, price range, or service type",
  mimeType: "application/json",
  content: JSON.stringify({
    filters: ["topics", "price_range", "service_type", "status"],
    service_types: ["AI_ANALYSIS", "DATA_PROCESSING", "API_INTEGRATION", "COMPUTATION", "STORAGE", "CUSTOM"]
  })
};

/**
 * Define service registration resource
 */
export const SERVICE_REGISTRATION_RESOURCE: Resource = {
  uri: "agent://service-registration",
  name: "Service Provider Portal",
  description: "Register and manage services in the marketplace",
  mimeType: "application/json",
  content: JSON.stringify({
    required_fields: ["name", "type", "price", "description", "privacy_settings"]
  })
};

/**
 * Define service content management resource
 */
export const SERVICE_CONTENT_RESOURCE: Resource = {
  uri: "agent://service-content",
  name: "Service Content Management",
  description: "Manage service content delivery and storage",
  mimeType: "application/json",
  content: JSON.stringify({
    required_fields: ["service_id", "content", "version"]
  })
};

/**
 * Define service payment resource
 */
export const SERVICE_PAYMENT_RESOURCE: Resource = {
  uri: "agent://service-payment",
  name: "Service Payment Processing",
  description: "Process payments for services. The system will automatically handle the payment transaction and send the payment notification to the service provider.",
  mimeType: "application/json",
  content: JSON.stringify({
    required_fields: ["service_id", "amount"],
    note: "The system will automatically handle the payment transaction and generate a unique transaction ID"
  })
};

/**
 * Define service delivery resource
 */
export const SERVICE_DELIVERY_RESOURCE: Resource = {
  uri: "agent://service-delivery",
  name: "Service Delivery Management",
  description: "Track and manage service deliveries",
  mimeType: "application/json",
  content: JSON.stringify({
    required_fields: ["payment_message_id", "service_id"]
  })
};

/**
 * Define data revelation resource
 */
export const DATA_REVELATION_RESOURCE: Resource = {
  uri: "agent://data-revelation",
  name: "Secure Data Revelation",
  description: "Securely reveal encrypted service content to authorized recipients",
  mimeType: "application/json",
  content: JSON.stringify({
    security_features: ["encryption", "access_control", "privacy_settings"]
  })
};

/**
 * Define available tools resource
 */
export const AVAILABLE_TOOLS_RESOURCE: Resource = {
  uri: "agent://available-tools",
  name: "Available Tools",
  description: "List of tools available for agent communication",
  mimeType: "application/json",
  content: JSON.stringify({
    tool_categories: ["authentication", "marketplace", "content", "payment", "delivery", "feedback", "management"]
  })
};

/**
 * List of all available resources
 */
export const RESOURCES = [
  DEFAULT_AGENT_RESOURCE,
  SERVICES_LIST_RESOURCE,
  SERVICE_REGISTRATION_RESOURCE,
  SERVICE_CONTENT_RESOURCE,
  SERVICE_PAYMENT_RESOURCE,
  SERVICE_DELIVERY_RESOURCE,
  DATA_REVELATION_RESOURCE,
  AVAILABLE_TOOLS_RESOURCE
];

/**
 * Handle list resources request
 */
export function handleListResources(): Resource[] {
  return RESOURCES;
}

/**
 * Handle read resource request
 * @param resourceUri The resource URI to read
 * @returns The resource metadata and content
 */
export function handleReadResource(resourceUri: string): Resource {
  const resource = RESOURCES.find((r) => r.uri === resourceUri);
  
  if (!resource) {
    throw new AppError(
      `Resource not found: ${resourceUri}`,
      'RESOURCE_NOT_FOUND',
      404
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