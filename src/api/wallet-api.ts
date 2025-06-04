import { config } from '../config.js';
import { logger } from '../logger.js';
import http from 'http';
import https from 'https';
import { URL } from 'url';

/**
 * Transaction verification result
 */
export interface TransactionVerificationResult {
  exists: boolean;
  syncStatus: {
    syncedIndices: string;
    lag: {
      applyGap: string;
      sourceGap: string;
    };
    isFullySynced: boolean;
  },
  transactionAmount: string;
}

export interface SendFundsResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

interface WalletApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Makes a call to the wallet API
 */
async function makeWalletApiCall<T>(
  endpoint: string,
  method: string,
  body?: any
): Promise<WalletApiResponse<T>> {
  if (!config.walletMcpUrl) {
    logger.error('WALLET_MCP_URL is not set in environment variables');
    return { success: false, error: 'Wallet MCP URL not configured' };
  }

  try {
    const baseUrl = config.walletMcpUrl.replace(/\/$/, '');
    const url = new URL(`${baseUrl}${endpoint}`);
    const client = url.protocol === 'https:' ? https : http;

    const postData = body ? JSON.stringify(body) : '';
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return await new Promise<WalletApiResponse<T>>((resolve) => {
      const req = client.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve({ success: true, data: result });
          } catch (err) {
            logger.error('Failed to parse wallet API response', { err, data });
            resolve({ success: false, error: 'Failed to parse response' });
          }
        });
      });
      req.on('error', (err) => {
        logger.error('Wallet API request failed', { err });
        resolve({ success: false, error: 'Request failed' });
      });
      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  } catch (err) {
    logger.error('Error in wallet API call', { err });
    return { success: false, error: 'Internal error' };
  }
}

export async function verifyTransaction(transactionId: string, amount: string): Promise<boolean> {
  const response = await makeWalletApiCall<TransactionVerificationResult>(
    '/wallet/verify-transaction',
    'POST',
    { identifier: transactionId }
  );

  if (!response.success) {
    logger.error('Transaction verification failed', { error: response.error });
    return false;
  }

  // Check if transaction exists and amount matches
  const result = response.data;
  return result?.exists === true && result?.transactionAmount === amount;
}

export async function sendFunds(destinationAddress: string, amount: string): Promise<SendFundsResult> {
  const response = await makeWalletApiCall<{ transactionId: string }>(
    '/wallet/send',
    'POST',
    { destinationAddress, amount }
  );

  if (!response.success) {
    return { success: false, error: response.error };
  }

  return {
    success: true,
    transactionId: response.data?.transactionId
  };
} 