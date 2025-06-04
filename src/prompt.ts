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
        description: "Service name (3-100 chars alphanumeric with spaces)",
        required: true
      },
      {
        name: "type",
        description: "Service type (3-50 chars). Suggested types: AI_ANALYSIS, DATA_PROCESSING, API_INTEGRATION, COMPUTATION, STORAGE, CUSTOM",
        required: true
      },
      {
        name: "price",
        description: "Service price (0 to 1000000)",
        required: true
      },
      {
        name: "description",
        description: "Service description (10-1000 chars)",
        required: true
      },
      {
        name: "midnight_wallet_address",
        description: "Your Midnight wallet address where you will receive payments",
        required: true
      },
      {
        name: "privacy_settings",
        description: "Privacy settings for the service including overall privacy (public or private)",
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
    description: "Initiate a service purchase. The system will automatically handle the payment transaction and send the payment notification to the service provider.",
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
                text: "I'd like to login to the marketplace"
              }
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: "I'll help you login. Please provide your email address."
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
                text: `Let's login with ${email}`
              }
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: `I'll help you login. I've sent a verification code to ${email}. Please check your email for the code or registration confirmation.`
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
              text: `Here's the code: ${otpCode}`
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I'll verify your code and complete the login process."
            }
          }
        ]
      };
    }

    case "listServices": {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "What services are available in the marketplace?"
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I'll show you all available services in the marketplace."
            }
          }
        ]
      };
    }

    case "registerService": {
      const { name, type, price, address, privacySettings, serviceId } = (args as unknown) as {
        name: string;
        type: string;
        price: number;
        address: string;
        privacySettings: string;
        serviceId: string;
      };
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "I want to register my new AI analysis service"
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I'll help you register your service. Please provide the service name, type, price, description, and your Midnight wallet address."
            }
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Here are the details:\nName: ${name}\nType: ${type}\nPrice: ${price}\nWallet: ${address}\nPrivacy Settings: ${privacySettings}`
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: `Great! I've registered your service. Your service has been created with ID: ${serviceId}`
            }
          }
        ]
      };
    }

    case "storeServiceContent": {
      const { serviceId, content } = (args as unknown) as {
        serviceId: string;
        content: string;
      };
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I need to store the content for my AI analysis service, here is the content for service ${serviceId}: ${content}`
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I'll help you store the content."
            }
          }
        ]
      };
    }

    case "servicePayment": {
      const { serviceId, amount, transactionId, paymentMessageId } = (args as unknown) as {
        serviceId: string;
        amount: number;
        transactionId: string;
        paymentMessageId: string;
      };
      if (!serviceId || !amount || !transactionId) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "I want to purchase the AI analysis service"
              }
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: "I'll help you complete the purchase. Please provide the service ID, payment amount, and the Midnight blockchain transaction ID."
              }
            },
            {
              role: "user",
              content: {
                type: "text",
                text: `I'd like to purchase the AI analysis service ${serviceId} with amount ${amount} and transaction ID ${transactionId}`
              }
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: `I'll help you complete the purchase. Here is the payment message ID: ${paymentMessageId}`
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
              text: `I'd like to purchase the AI analysis service ${serviceId} with amount ${amount} and transaction ID ${transactionId}`
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: `I'll help you complete the purchase. Here is the payment message ID: ${paymentMessageId}`
            }
          }
        ]
      };
    }

    case "queryServiceDelivery": {
      const { paymentMessageId, serviceId } = (args as unknown) as {
        paymentMessageId: string;
        serviceId: string;
      };

      if (!paymentMessageId || !serviceId) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Can you check the status of my recent service purchase?"
              }
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: "I'll check the delivery status. Please provide the payment message ID and service ID."
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
              text: `I'd like to check the status of my recent service purchase for service ${serviceId} with payment message ID ${paymentMessageId}`
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I'll check the delivery status. Please wait a moment."
            }
          }
        ]
      };
    }

    case "provideServiceFeedback": {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "I'd like to leave feedback for the AI analysis service I used"
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I'll help you submit your feedback. Please provide the service ID, your rating (1-5), and your detailed feedback."
            }
          }
        ]
      };
    }

    case "disableService": {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "I need to disable my AI analysis service"
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I'll help you disable the service. Please provide the service ID you want to disable."
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
              text: "Can you check if I'm properly connected to the marketplace?"
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I'll check your connection status and authentication state in the marketplace."
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
