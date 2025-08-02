/**
 * Check if a tool requires authentication
 * @param toolName - The name of the tool to check
 * @returns True if the tool requires authentication
 */
export function isAuthRequired(toolName: string): boolean {
  const authRequiredTools = [
    'listServices',
    'registerService',
    'storeServiceContent',
    'servicePayment',
    'queryServiceDelivery',
    'provideServiceFeedback'
  ];
  return authRequiredTools.includes(toolName);
}

/**
 * Get the list of tools that require authentication
 * @returns Array of tool names that require authentication
 */
export function getAuthRequiredTools(): string[] {
  return [
    'listServices',
    'registerService',
    'storeServiceContent',
    'servicePayment',
    'queryServiceDelivery',
    'provideServiceFeedback'
  ];
} 