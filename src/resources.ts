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
  description: "Core information about the agent's communication capabilities, including service marketplace features, payment processing, and secure content delivery",
  mimeType: "application/json"
};

/**
 * Define services list resource
 */
export const SERVICES_LIST_RESOURCE: Resource = {
  uri: "agent://services",
  name: "Service Marketplace",
  description: "Browse and search the service marketplace. Filter services by topics, price range, or service type. Each service listing includes name, type, price, description, and privacy settings",
  mimeType: "application/json"
};

/**
 * Define service registration resource
 */
export const SERVICE_REGISTRATION_RESOURCE: Resource = {
  uri: "agent://service-registration",
  name: "Service Provider Portal",
  description: "Register and manage your services in the marketplace. Define service details, pricing, and privacy settings. This resource allows service providers to create and update their service offerings",
  mimeType: "application/json"
};

/**
 * Define service content management resource
 */
export const SERVICE_CONTENT_RESOURCE: Resource = {
  uri: "agent://service-content",
  name: "Service Content Management",
  description: "Manage the content that will be delivered to customers when they purchase your service. Store, version, and tag your service content securely",
  mimeType: "application/json"
};

/**
 * Define service payment resource
 */
export const SERVICE_PAYMENT_RESOURCE: Resource = {
  uri: "agent://service-payment",
  name: "Service Payment Processing",
  description: "Process payments for services using the Midnight blockchain. This resource handles payment notifications, transaction verification, and initiates the service delivery process",
  mimeType: "application/json"
};

/**
 * Define service delivery resource
 */
export const SERVICE_DELIVERY_RESOURCE: Resource = {
  uri: "agent://service-delivery",
  name: "Service Delivery Management",
  description: "Track and manage service deliveries. Check delivery status, retrieve service content, and verify successful delivery of purchased services",
  mimeType: "application/json"
};

/**
 * Define data revelation resource
 */
export const DATA_REVELATION_RESOURCE: Resource = {
  uri: "agent://data-revelation",
  name: "Secure Data Revelation",
  description: "Securely reveal encrypted service content to authorized recipients. This resource handles the decryption and delivery of sensitive service data",
  mimeType: "application/json"
};

/**
 * Define available tools resource
 */
export const AVAILABLE_TOOLS_RESOURCE: Resource = {
  uri: "agent://available-tools",
  name: "Available Tools",
  description: "Comprehensive list of tools available for agent communication, including service marketplace operations, payment processing, and content delivery management",
  mimeType: "application/json"
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