import { jest, describe, it, expect } from '@jest/globals';
import {
  MESSAGE_TOPICS,
  CONTENT_TYPES,
  MESSAGE_STATUS,
  SERVICE_PRIVACY_LEVELS,
  TRANSACTION_TYPES,
  MESSAGE_PURPOSE,
  hasEncryptedContent,
  hasPublicContent,
  hasPrivateContent,
  isValidMessageTopic,
  isValidContentType,
  isValidMessageStatus,
  isValidServicePrivacyLevel,
  type Message,
  type MessagePublic,
  type EncryptedMessage
} from '../../src/supabase/message-types.js';

describe('Message Types', () => {
  describe('Constants', () => {
    it('should have correct MESSAGE_TOPICS values', () => {
      expect(MESSAGE_TOPICS.SERVICE).toBe('service');
      expect(MESSAGE_TOPICS.NOTIFICATION).toBe('notification');
      expect(MESSAGE_TOPICS.PAYMENT).toBe('payment');
      expect(MESSAGE_TOPICS.DELIVERY).toBe('delivery');
      expect(MESSAGE_TOPICS.FEEDBACK).toBe('feedback');
    });

    it('should have correct CONTENT_TYPES values', () => {
      expect(CONTENT_TYPES.TEXT).toBe('text');
      expect(CONTENT_TYPES.JSON).toBe('json');
      expect(CONTENT_TYPES.TRANSACTION).toBe('transaction');
      expect(CONTENT_TYPES.IMAGE).toBe('image');
    });

    it('should have correct MESSAGE_STATUS values', () => {
      expect(MESSAGE_STATUS.PENDING).toBe('pending');
      expect(MESSAGE_STATUS.COMPLETED).toBe('completed');
      expect(MESSAGE_STATUS.FAILED).toBe('failed');
      expect(MESSAGE_STATUS.CANCELLED).toBe('cancelled');
    });

    it('should have correct SERVICE_PRIVACY_LEVELS values', () => {
      expect(SERVICE_PRIVACY_LEVELS.PUBLIC).toBe('public');
      expect(SERVICE_PRIVACY_LEVELS.PRIVATE).toBe('private');
    });

    it('should have correct TRANSACTION_TYPES values', () => {
      expect(TRANSACTION_TYPES.PAYMENT_NOTIFICATION).toBe('payment_notification');
      expect(TRANSACTION_TYPES.SERVICE_DELIVERY).toBe('service_delivery');
      expect(TRANSACTION_TYPES.PAYMENT_CONFIRMATION).toBe('payment_confirmation');
    });

    it('should have correct MESSAGE_PURPOSE values', () => {
      expect(MESSAGE_PURPOSE.PAYMENT_NOTIFICATION).toBe('payment_notification');
      expect(MESSAGE_PURPOSE.SERVICE_DELIVERY).toBe('service_delivery');
      expect(MESSAGE_PURPOSE.PAYMENT_CONFIRMATION).toBe('payment_confirmation');
    });
  });

  describe('Validation Functions', () => {
    describe('isValidMessageTopic', () => {
      it('should return true for valid message topics', () => {
        expect(isValidMessageTopic('service')).toBe(true);
        expect(isValidMessageTopic('notification')).toBe(true);
        expect(isValidMessageTopic('payment')).toBe(true);
        expect(isValidMessageTopic('delivery')).toBe(true);
        expect(isValidMessageTopic('feedback')).toBe(true);
      });

      it('should return false for invalid message topics', () => {
        expect(isValidMessageTopic('invalid')).toBe(false);
        expect(isValidMessageTopic('')).toBe(false);
        expect(isValidMessageTopic('SERVICE')).toBe(false);
        expect(isValidMessageTopic('Service')).toBe(false);
      });
    });

    describe('isValidContentType', () => {
      it('should return true for valid content types', () => {
        expect(isValidContentType('text')).toBe(true);
        expect(isValidContentType('json')).toBe(true);
        expect(isValidContentType('transaction')).toBe(true);
        expect(isValidContentType('image')).toBe(true);
      });

      it('should return false for invalid content types', () => {
        expect(isValidContentType('invalid')).toBe(false);
        expect(isValidContentType('')).toBe(false);
        expect(isValidContentType('TEXT')).toBe(false);
        expect(isValidContentType('Text')).toBe(false);
      });
    });

    describe('isValidMessageStatus', () => {
      it('should return true for valid message statuses', () => {
        expect(isValidMessageStatus('pending')).toBe(true);
        expect(isValidMessageStatus('completed')).toBe(true);
        expect(isValidMessageStatus('failed')).toBe(true);
        expect(isValidMessageStatus('cancelled')).toBe(true);
      });

      it('should return false for invalid message statuses', () => {
        expect(isValidMessageStatus('invalid')).toBe(false);
        expect(isValidMessageStatus('')).toBe(false);
        expect(isValidMessageStatus('PENDING')).toBe(false);
        expect(isValidMessageStatus('Pending')).toBe(false);
      });
    });

    describe('isValidServicePrivacyLevel', () => {
      it('should return true for valid privacy levels', () => {
        expect(isValidServicePrivacyLevel('public')).toBe(true);
        expect(isValidServicePrivacyLevel('private')).toBe(true);
      });

      it('should return false for invalid privacy levels', () => {
        expect(isValidServicePrivacyLevel('invalid')).toBe(false);
        expect(isValidServicePrivacyLevel('')).toBe(false);
        expect(isValidServicePrivacyLevel('PUBLIC')).toBe(false);
        expect(isValidServicePrivacyLevel('Public')).toBe(false);
      });
    });
  });

  describe('Type Guard Functions', () => {
    describe('hasEncryptedContent', () => {
      it('should return true for messages with encrypted content', () => {
        const message = {
          private: {
            encryptedMessage: {
              nonce: 'test-nonce',
              ciphertext: 'test-ciphertext',
              tag: 'test-tag'
            },
            encryptedKeys: {
              recipient: 'test-recipient',
              auditor: 'test-auditor'
            }
          }
        };

        expect(hasEncryptedContent(message)).toBe(true);
      });

      it('should return false for messages without encrypted content', () => {
        const messageWithoutContent = {
          private: {}
        };

        const messageWithoutCiphertext = {
          private: {
            encryptedMessage: {
              nonce: 'test-nonce',
              ciphertext: '',
              tag: 'test-tag'
            },
            encryptedKeys: {
              recipient: 'test-recipient',
              auditor: 'test-auditor'
            }
          }
        };

        const messageWithoutRecipient = {
          private: {
            encryptedMessage: {
              nonce: 'test-nonce',
              ciphertext: 'test-ciphertext',
              tag: 'test-tag'
            },
            encryptedKeys: {
              recipient: '',
              auditor: 'test-auditor'
            }
          }
        };

        expect(hasEncryptedContent(messageWithoutContent)).toBe(false);
        expect(hasEncryptedContent(messageWithoutCiphertext)).toBe(false);
        expect(hasEncryptedContent(messageWithoutRecipient)).toBe(false);
      });

      it('should return false for null/undefined encrypted content', () => {
        const messageWithNull = {
          private: {
            encryptedMessage: null as any,
            encryptedKeys: {
              recipient: 'test-recipient',
              auditor: 'test-auditor'
            }
          }
        };

        const messageWithUndefined = {
          private: {
            encryptedMessage: undefined as any,
            encryptedKeys: {
              recipient: 'test-recipient',
              auditor: 'test-auditor'
            }
          }
        };

        expect(hasEncryptedContent(messageWithNull)).toBe(false);
        expect(hasEncryptedContent(messageWithUndefined)).toBe(false);
      });
    });

    describe('hasPublicContent', () => {
      it('should return true for messages with valid public content', () => {
        const message: Message = {
          sender_agent_id: 'agent-1',
          recipient_agent_id: 'agent-2',
          conversation_id: 'conv-1',
          public: {
            topic: 'service',
            serviceId: 'service-1',
            content: {
              type: 'text',
              data: 'Hello',
              metadata: {
                timestamp: '2023-01-01T00:00:00Z',
                version: '1.0'
              }
            }
          },
          private: {}
        };

        expect(hasPublicContent(message)).toBe(true);
      });

      it('should return false for messages without public content', () => {
        const messageWithoutPublic: Message = {
          sender_agent_id: 'agent-1',
          recipient_agent_id: 'agent-2',
          conversation_id: 'conv-1',
          public: {},
          private: {}
        };

        const messageWithInvalidTopic: Message = {
          sender_agent_id: 'agent-1',
          recipient_agent_id: 'agent-2',
          conversation_id: 'conv-1',
          public: {
            topic: 'invalid-topic' as any,
            content: {
              type: 'text',
              data: 'Hello',
              metadata: {
                timestamp: '2023-01-01T00:00:00Z',
                version: '1.0'
              }
            }
          },
          private: {}
        };

        expect(hasPublicContent(messageWithoutPublic)).toBe(false);
        expect(hasPublicContent(messageWithInvalidTopic)).toBe(false);
      });

      it('should return false for messages with null/undefined public content', () => {
        const messageWithNullPublic: Message = {
          sender_agent_id: 'agent-1',
          recipient_agent_id: 'agent-2',
          conversation_id: 'conv-1',
          public: null as any,
          private: {}
        };

        expect(hasPublicContent(messageWithNullPublic)).toBe(false);
      });
    });

    describe('hasPrivateContent', () => {
      it('should return true for messages with encrypted message content', () => {
        const message: Message = {
          sender_agent_id: 'agent-1',
          recipient_agent_id: 'agent-2',
          conversation_id: 'conv-1',
          public: {},
          private: {
            encryptedMessage: {
              nonce: 'test-nonce',
              ciphertext: 'test-ciphertext',
              tag: 'test-tag'
            }
          }
        };

        expect(hasPrivateContent(message)).toBe(true);
      });

      it('should return true for messages with encrypted keys content', () => {
        const message: Message = {
          sender_agent_id: 'agent-1',
          recipient_agent_id: 'agent-2',
          conversation_id: 'conv-1',
          public: {},
          private: {
            encryptedKeys: {
              recipient: 'test-recipient',
              auditor: 'test-auditor'
            }
          }
        };

        expect(hasPrivateContent(message)).toBe(true);
      });

      it('should return true for messages with both encrypted message and keys', () => {
        const message: Message = {
          sender_agent_id: 'agent-1',
          recipient_agent_id: 'agent-2',
          conversation_id: 'conv-1',
          public: {},
          private: {
            encryptedMessage: {
              nonce: 'test-nonce',
              ciphertext: 'test-ciphertext',
              tag: 'test-tag'
            },
            encryptedKeys: {
              recipient: 'test-recipient',
              auditor: 'test-auditor'
            }
          }
        };

        expect(hasPrivateContent(message)).toBe(true);
      });

      it('should return false for messages without private content', () => {
        const messageWithoutPrivate: Message = {
          sender_agent_id: 'agent-1',
          recipient_agent_id: 'agent-2',
          conversation_id: 'conv-1',
          public: {},
          private: {}
        };

        const messageWithEmptyEncryptedMessage: Message = {
          sender_agent_id: 'agent-1',
          recipient_agent_id: 'agent-2',
          conversation_id: 'conv-1',
          public: {},
          private: {
            encryptedMessage: {} as any
          }
        };

        const messageWithEmptyEncryptedKeys: Message = {
          sender_agent_id: 'agent-1',
          recipient_agent_id: 'agent-2',
          conversation_id: 'conv-1',
          public: {},
          private: {
            encryptedKeys: {} as any
          }
        };

        expect(hasPrivateContent(messageWithoutPrivate)).toBe(false);
        expect(hasPrivateContent(messageWithEmptyEncryptedMessage)).toBe(false);
        expect(hasPrivateContent(messageWithEmptyEncryptedKeys)).toBe(false);
      });

      it('should return false for messages with null/undefined private content', () => {
        const messageWithNullPrivate: Message = {
          sender_agent_id: 'agent-1',
          recipient_agent_id: 'agent-2',
          conversation_id: 'conv-1',
          public: {},
          private: null as any
        };

        expect(hasPrivateContent(messageWithNullPrivate)).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty objects in validation functions', () => {
      expect(isValidMessageTopic('')).toBe(false);
      expect(isValidContentType('')).toBe(false);
      expect(isValidMessageStatus('')).toBe(false);
      expect(isValidServicePrivacyLevel('')).toBe(false);
    });

    it('should handle case sensitivity in validation functions', () => {
      expect(isValidMessageTopic('Service')).toBe(false);
      expect(isValidContentType('Text')).toBe(false);
      expect(isValidMessageStatus('Pending')).toBe(false);
      expect(isValidServicePrivacyLevel('Public')).toBe(false);
    });

    it('should handle null/undefined values in type guards', () => {
      const messageWithNulls: Message = {
        sender_agent_id: 'agent-1',
        recipient_agent_id: 'agent-2',
        conversation_id: 'conv-1',
        public: null as any,
        private: null as any
      };

      expect(hasPublicContent(messageWithNulls)).toBe(false);
      expect(hasPrivateContent(messageWithNulls)).toBe(false);
    });
  });
}); 