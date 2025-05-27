import { GetPromptRequest, GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptInfo {
  name: string;
  description: string;
  arguments: PromptArgument[];
}

// Prompt definitions
export const PROMPTS: Record<string, PromptInfo> = {
  "status": {
    name: "status",
    description: "Check the connection status and authentication state of the agent in the marketplace. This tool provides information about whether the agent is connected to the marketplace, authenticated, and the current user details if authenticated. Also it provides the agent storage name of the local files. This tool should be called first to verify system readiness.",
    arguments: []
  },
  "login": {
    name: "login",
    description: "Login or register with email authentication",
    arguments: [
      {
        name: "email",
        description: "Email address to login/register with",
        required: true
      },
      {
        name: "otpCode",
        description: "Optional 6-digit verification code received via email",
        required: false
      },
      {
        name: "registrationConfirmed",
        description: "Set to true if you received and accepted the registration confirmation email",
        required: false
      }
    ]
  },
  "listServices": {
    name: "listServices",
    description: "List available services with filtering options",
    arguments: [
      {
        name: "topics",
        description: "Optional list of topics to filter services by",
        required: false
      },
      {
        name: "minPrice",
        description: "Optional minimum price filter",
        required: false
      },
      {
        name: "maxPrice",
        description: "Optional maximum price filter",
        required: false
      },
      {
        name: "serviceType",
        description: "Optional service type filter",
        required: false
      },
      {
        name: "includeInactive",
        description: "Optional flag to include inactive services in the results",
        required: false
      }
    ]
  },
  "registerService": {
    name: "registerService",
    description: "Register a new service in the marketplace",
    arguments: [
      {
        name: "name",
        description: "Service name (3-100 chars, alphanumeric with spaces, hyphens, underscores)",
        required: true
      },
      {
        name: "type",
        description: "Service type (3-50 chars, alphanumeric with underscores). Suggested types: AI_ANALYSIS, DATA_PROCESSING, API_INTEGRATION, COMPUTATION, STORAGE, CUSTOM",
        required: true
      },
      {
        name: "price",
        description: "Service price (0 to 1,000,000)",
        required: true
      },
      {
        name: "description",
        description: "Service description (10-1000 chars)",
        required: true
      },
      {
        name: "midnight_wallet_address",
        description: "Your Midnight wallet address where you will receive payments (32+ chars, alphanumeric)",
        required: true
      },
      {
        name: "privacy_settings",
        description: "Privacy settings for the service including overall privacy and terms & conditions",
        required: true
      }
    ]
  },
  "storeServiceContent": {
    name: "storeServiceContent",
    description: "Store content for a registered service",
    arguments: [
      {
        name: "serviceId",
        description: "The UUID of the service (obtained from registerService)",
        required: true
      },
      {
        name: "content",
        description: "The content to be delivered to customers",
        required: true
      },
      {
        name: "version",
        description: "Version of the content",
        required: true
      },
      {
        name: "tags",
        description: "Optional tags for better organization",
        required: false
      }
    ]
  },
  "servicePayment": {
    name: "servicePayment",
    description: "Initiate a service purchase by sending a payment notification",
    arguments: [
      {
        name: "serviceId",
        description: "The UUID of the service (obtained from listServices)",
        required: true
      },
      {
        name: "amount",
        description: "Payment amount (must match service price)",
        required: true
      },
      {
        name: "transactionId",
        description: "The Midnight blockchain transaction identifier",
        required: true
      }
    ]
  },
  "queryServiceDelivery": {
    name: "queryServiceDelivery",
    description: "Check the status and retrieve the content of a service delivery",
    arguments: [
      {
        name: "paymentMessageId",
        description: "The ID of the payment message (obtained from servicePayment)",
        required: true
      },
      {
        name: "serviceId",
        description: "The ID of the service (obtained from listServices)",
        required: true
      }
    ]
  },
  "provideServiceFeedback": {
    name: "provideServiceFeedback",
    description: "Submit feedback for a service",
    arguments: [
      {
        name: "serviceId",
        description: "ID of the service being reviewed (obtained from listServices)",
        required: true
      },
      {
        name: "rating",
        description: "Rating from 1 to 5",
        required: true
      },
      {
        name: "feedback",
        description: "Detailed feedback about the service (10-1000 chars)",
        required: true
      },
      {
        name: "parentMessageId",
        description: "Optional ID of the delivery message this feedback is for",
        required: false
      }
    ]
  },
  "disableService": {
    name: "disableService",
    description: "Disable a service that you no longer want to provide",
    arguments: [
      {
        name: "serviceId",
        description: "ID of the service to disable (obtained from registerService)",
        required: true
      }
    ]
  }
};

export function listPrompts(): { prompts: PromptInfo[] } {
  return {
    prompts: Object.values(PROMPTS)
  };
}

export function getPrompt(request: GetPromptRequest): GetPromptResult {
  const { name, arguments: args } = request.params;
  const prompt = PROMPTS[name];
  if (!prompt) {
    throw new Error(`Unknown prompt: ${name}`);
  }

  switch (name) {
    case "login": {
      const email = args?.email as string | undefined;
      const otpCode = args?.otpCode as string | undefined;
      const registrationConfirmed = Boolean(args?.registrationConfirmed);

      if (!email) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Please provide your email address for authentication."
              }
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: "I'll help you authenticate. Please enter your email address."
              }
            }
          ]
        };
      }

      if (!otpCode) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Please enter the OTP code sent to ${email}`
              }
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: "I'll verify your OTP code. Please enter the code you received."
              }
            }
          ]
        };
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Authenticating with email ${email} and OTP code. ${registrationConfirmed ? "This is a new registration." : ""}`
            }
          }
        ]
      };
    }

    case "listServices": {
      const topics = Array.isArray(args?.topics) ? args.topics as string[] : undefined;
      const minPrice = typeof args?.minPrice === 'number' ? args.minPrice : undefined;
      const maxPrice = typeof args?.maxPrice === 'number' ? args.maxPrice : undefined;
      const serviceType = typeof args?.serviceType === 'string' ? args.serviceType : undefined;
      const includeInactive = Boolean(args?.includeInactive);

      const filters = [
        topics?.length && `in topics: ${topics.join(", ")}`,
        minPrice && `with minimum price: ${minPrice}`,
        maxPrice && `with maximum price: ${maxPrice}`,
        serviceType && `of type: ${serviceType}`,
        includeInactive && "including inactive services"
      ].filter(Boolean);

      const filterText = filters.length 
        ? `Listing available services ${filters.join(", ")}`
        : "Listing available services";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: filterText
            }
          }
        ]
      };
    }

    case "status": {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Checking status for agent`
            }
          }
        ]
      };
    }

    default:
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: prompt.description
            }
          }
        ]
      };
  }
}
