import { GetPromptRequest } from "@modelcontextprotocol/sdk/types.js";
import { PROMPTS, listPrompts, getPrompt, PromptInfo, PromptArgument } from '../src/prompt.js';

describe('prompt.ts', () => {
  describe('PROMPTS object', () => {
    it('should contain all expected prompt definitions', () => {
      const expectedPrompts = [
        'status',
        'login',
        'listServices',
        'registerService',
        'storeServiceContent',
        'servicePayment',
        'queryServiceDelivery',
        'provideServiceFeedback',
        'disableService'
      ];

      expectedPrompts.forEach(promptName => {
        expect(PROMPTS[promptName]).toBeDefined();
        expect(PROMPTS[promptName].name).toBe(promptName);
        expect(PROMPTS[promptName].description).toBeDefined();
        expect(Array.isArray(PROMPTS[promptName].arguments)).toBe(true);
      });
    });

    it('should have correct structure for each prompt', () => {
      Object.values(PROMPTS).forEach(prompt => {
        expect(typeof prompt.name).toBe('string');
        expect(typeof prompt.description).toBe('string');
        expect(Array.isArray(prompt.arguments)).toBe(true);
        
        prompt.arguments.forEach(arg => {
          expect(typeof arg.name).toBe('string');
          expect(typeof arg.description).toBe('string');
          expect(typeof arg.required).toBe('boolean');
        });
      });
    });

    it('should have status prompt with no arguments', () => {
      const statusPrompt = PROMPTS['status'];
      expect(statusPrompt.arguments).toEqual([]);
    });

    it('should have login prompt with correct arguments', () => {
      const loginPrompt = PROMPTS['login'];
      const expectedArgs = [
        { name: 'email', description: expect.any(String), required: true },
        { name: 'otpCode', description: expect.any(String), required: false },
        { name: 'registrationConfirmed', description: expect.any(String), required: false }
      ];
      
      expect(loginPrompt.arguments).toHaveLength(3);
      expect(loginPrompt.arguments).toEqual(expect.arrayContaining(expectedArgs));
    });

    it('should have registerService prompt with required arguments', () => {
      const registerPrompt = PROMPTS['registerService'];
      const requiredArgs = ['name', 'type', 'price', 'description', 'midnight_wallet_address', 'privacy_settings'];
      
      requiredArgs.forEach(argName => {
        const arg = registerPrompt.arguments.find(a => a.name === argName);
        expect(arg).toBeDefined();
        expect(arg?.required).toBe(true);
      });
    });
  });

  describe('listPrompts', () => {
    it('should return all prompts in the correct format', () => {
      const result = listPrompts();
      
      expect(result).toHaveProperty('prompts');
      expect(Array.isArray(result.prompts)).toBe(true);
      expect(result.prompts).toHaveLength(Object.keys(PROMPTS).length);
    });

    it('should return prompts with correct structure', () => {
      const result = listPrompts();
      
      result.prompts.forEach(prompt => {
        expect(prompt).toHaveProperty('name');
        expect(prompt).toHaveProperty('description');
        expect(prompt).toHaveProperty('arguments');
        expect(Array.isArray(prompt.arguments)).toBe(true);
      });
    });

    it('should return the same prompts as defined in PROMPTS', () => {
      const result = listPrompts();
      const expectedPrompts = Object.values(PROMPTS);
      
      expect(result.prompts).toEqual(expectedPrompts);
    });
  });

  describe('getPrompt', () => {
    it('should throw error for unknown prompt', () => {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'unknownPrompt',
          arguments: {}
        }
      };

      expect(() => getPrompt(request)).toThrow('Unknown prompt: unknownPrompt');
    });

    describe('status prompt', () => {
      it('should return correct messages for status prompt', () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'status',
            arguments: {}
          }
        };

        const result = getPrompt(request);

        expect(result).toHaveProperty('messages');
        expect(Array.isArray(result.messages)).toBe(true);
        expect(result.messages).toHaveLength(2);
        
        expect(result.messages[0].role).toBe('user');
        expect(result.messages[0].content.type).toBe('text');
        expect(result.messages[0].content.text).toContain('connected to the marketplace');
        
        expect(result.messages[1].role).toBe('assistant');
        expect(result.messages[1].content.type).toBe('text');
        expect(result.messages[1].content.text).toContain('connection status');
      });
    });

    describe('login prompt', () => {
      it('should return initial login message when no email provided', () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'login',
            arguments: {}
          }
        };

        const result = getPrompt(request);

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].content.text).toContain('login to the marketplace');
        expect(result.messages[1].content.text).toContain('provide your email address');
      });

      it('should return verification message when email provided but no OTP', () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'login',
            arguments: {
              email: 'test@example.com'
            }
          }
        };

        const result = getPrompt(request);

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].content.text).toContain('test@example.com');
        expect(result.messages[1].content.text).toContain('verification code');
        expect(result.messages[1].content.text).toContain('test@example.com');
      });

      it('should return verification message when email and OTP provided', () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'login',
            arguments: {
              email: 'test@example.com',
              otpCode: '123456'
            }
          }
        };

        const result = getPrompt(request);

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].content.text).toContain('123456');
        expect(result.messages[1].content.text).toContain('verify your code');
      });
    });

    describe('listServices prompt', () => {
      it('should return correct messages for listServices prompt', () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'listServices',
            arguments: {}
          }
        };

        const result = getPrompt(request);

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].content.text).toContain('services are available');
        expect(result.messages[1].content.text).toContain('show you all available services');
      });
    });

    describe('registerService prompt', () => {
      it('should return correct messages for registerService prompt with all arguments', () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'registerService',
            arguments: {
              name: 'Test Service',
              type: 'AI_ANALYSIS',
              price: '100',
              address: 'test-wallet-address',
              privacySettings: 'public',
              serviceId: 'test-service-id'
            }
          }
        };

        const result = getPrompt(request);

        expect(result.messages).toHaveLength(4);
        expect(result.messages[0].content.text).toContain('register my new AI analysis service');
        expect(result.messages[2].content.text).toContain('Test Service');
        expect(result.messages[2].content.text).toContain('AI_ANALYSIS');
        expect(result.messages[2].content.text).toContain('100');
        expect(result.messages[2].content.text).toContain('test-wallet-address');
        expect(result.messages[2].content.text).toContain('public');
        expect(result.messages[3].content.text).toContain('test-service-id');
      });
    });

    describe('storeServiceContent prompt', () => {
      it('should return correct messages for storeServiceContent prompt', () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'storeServiceContent',
            arguments: {
              serviceId: 'test-service-id',
              content: 'Test content for the service'
            }
          }
        };

        const result = getPrompt(request);

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].content.text).toContain('test-service-id');
        expect(result.messages[0].content.text).toContain('Test content for the service');
        expect(result.messages[1].content.text).toContain('store the content');
      });
    });

    describe('servicePayment prompt', () => {
      it('should return initial payment message when missing required arguments', () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'servicePayment',
            arguments: {}
          }
        };

        const result = getPrompt(request);

        expect(result.messages).toHaveLength(4);
        expect(result.messages[0].content.text).toContain('purchase the AI analysis service');
        expect(result.messages[1].content.text).toContain('service ID, payment amount');
        expect(result.messages[2].content.text).toContain('purchase the AI analysis service');
        expect(result.messages[3].content.text).toContain('payment message ID');
      });

      it('should return payment confirmation when all arguments provided', () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'servicePayment',
            arguments: {
              serviceId: 'test-service-id',
              amount: '100',
              transactionId: 'test-transaction-id',
              paymentMessageId: 'test-payment-message-id'
            }
          }
        };

        const result = getPrompt(request);

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].content.text).toContain('test-service-id');
        expect(result.messages[0].content.text).toContain('100');
        expect(result.messages[0].content.text).toContain('test-transaction-id');
        expect(result.messages[1].content.text).toContain('test-payment-message-id');
      });
    });

    describe('queryServiceDelivery prompt', () => {
      it('should return initial query message when missing required arguments', () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'queryServiceDelivery',
            arguments: {}
          }
        };

        const result = getPrompt(request);

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].content.text).toContain('check the status of my recent service purchase');
        expect(result.messages[1].content.text).toContain('payment message ID and service ID');
      });

      it('should return query confirmation when all arguments provided', () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'queryServiceDelivery',
            arguments: {
              paymentMessageId: 'test-payment-message-id',
              serviceId: 'test-service-id'
            }
          }
        };

        const result = getPrompt(request);

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].content.text).toContain('test-service-id');
        expect(result.messages[0].content.text).toContain('test-payment-message-id');
        expect(result.messages[1].content.text).toContain('check the delivery status');
      });
    });

    describe('provideServiceFeedback prompt', () => {
      it('should return correct messages for provideServiceFeedback prompt', () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'provideServiceFeedback',
            arguments: {}
          }
        };

        const result = getPrompt(request);

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].content.text).toContain('leave feedback for the AI analysis service');
        expect(result.messages[1].content.text).toContain('service ID, your rating');
      });
    });

    describe('disableService prompt', () => {
      it('should return correct messages for disableService prompt', () => {
        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'disableService',
            arguments: {}
          }
        };

        const result = getPrompt(request);

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].content.text).toContain('disable my AI analysis service');
        expect(result.messages[1].content.text).toContain('service ID you want to disable');
      });
    });

    describe('default case', () => {
      it('should return default message for unknown prompt type', () => {
        // Create a temporary prompt for testing
        const tempPrompt: PromptInfo = {
          name: 'testPrompt',
          description: 'Test prompt description',
          arguments: []
        };
        
        // Temporarily add to PROMPTS
        const originalPrompts = { ...PROMPTS };
        (PROMPTS as any)['testPrompt'] = tempPrompt;

        const request: GetPromptRequest = {
          method: 'prompts/get',
          params: {
            name: 'testPrompt',
            arguments: {}
          }
        };

        const result = getPrompt(request);

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].role).toBe('user');
        expect(result.messages[0].content.type).toBe('text');
        expect(result.messages[0].content.text).toBe('Test prompt description');

        // Restore original PROMPTS
        Object.assign(PROMPTS, originalPrompts);
      });
    });
  });

  describe('Type definitions', () => {
    it('should have correct PromptArgument interface', () => {
      const arg: PromptArgument = {
        name: 'test',
        description: 'test description',
        required: true
      };

      expect(arg.name).toBe('test');
      expect(arg.description).toBe('test description');
      expect(arg.required).toBe(true);
    });

    it('should have correct PromptInfo interface', () => {
      const info: PromptInfo = {
        name: 'test',
        description: 'test description',
        arguments: []
      };

      expect(info.name).toBe('test');
      expect(info.description).toBe('test description');
      expect(Array.isArray(info.arguments)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty arguments object', () => {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'status',
          arguments: {}
        }
      };

      expect(() => getPrompt(request)).not.toThrow();
    });

    it('should handle null arguments', () => {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'login',
          arguments: null as any
        }
      };

      expect(() => getPrompt(request)).not.toThrow();
    });

    it('should handle undefined arguments', () => {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'login',
          arguments: undefined as any
        }
      };

      expect(() => getPrompt(request)).not.toThrow();
    });

    it('should handle boolean conversion for registrationConfirmed', () => {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'login',
          arguments: {
            email: 'test@example.com',
            registrationConfirmed: 'true'
          }
        }
      };

      expect(() => getPrompt(request)).not.toThrow();
    });
  });
}); 