import { config } from '../config.js';
import { logger } from '../logger.js';
import http from 'http';
import https from 'https';
import { URL } from 'url';

export async function verifyTransaction(transactionId: string): Promise<boolean> {
  if (!config.walletMcpUrl) {
    logger.error('WALLET_MCP_URL is not set in environment variables');
    return false;
  }

  try {
    const baseUrl = config.walletMcpUrl.replace(/\/$/, '');
    const url = new URL(`${baseUrl}/wallet/verify-transaction`);
    const client = url.protocol === 'https:' ? https : http;

    const postData = JSON.stringify({ identifier: transactionId });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return await new Promise<boolean>((resolve) => {
      const req = client.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(!!json.valid);
          } catch (err) {
            logger.error('Failed to parse wallet API response', { err, data });
            resolve(false);
          }
        });
      });
      req.on('error', (err) => {
        logger.error('Wallet API request failed', { err });
        resolve(false);
      });
      req.write(postData);
      req.end();
    });
  } catch (err) {
    logger.error('Error in verifyTransaction', { err });
    return false;
  }
} 