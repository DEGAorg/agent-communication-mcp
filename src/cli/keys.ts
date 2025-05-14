import { logger } from '../logger.js';
import { x25519 } from '@noble/curves/ed25519';
import { randomBytes } from '@noble/hashes/utils';
import chalk from 'chalk';

class KeyPairGenerator {
  static generateKeyPair(): { publicKey: string; privateKey: string } {
    // Generate X25519 key pair
    const privateKey = randomBytes(32);
    const publicKey = x25519.getPublicKey(privateKey);
    
    // Convert to base64 for storage
    const publicKeyBase64 = Buffer.from(publicKey).toString('base64');
    const privateKeyBase64 = Buffer.from(privateKey).toString('base64');

    return {
      publicKey: publicKeyBase64,
      privateKey: privateKeyBase64
    };
  }
}

async function generateKeys() {
  try {
    const { publicKey, privateKey } = KeyPairGenerator.generateKeyPair();
    
    console.log('\n' + chalk.bold.red('⚠️  SECURITY WARNING ⚠️'));
    console.log(chalk.red('The following keys are sensitive information.'));
    console.log(chalk.red('Keep them secure and never share them with anyone.\n'));
    
    console.log(chalk.bold.green('🔑 Generated new X25519 key pair:'));
    console.log(chalk.yellow('\nAdd these to your .env file:'));
    console.log(chalk.cyan('AGENT_PUBLIC_KEY=') + chalk.white(publicKey));
    console.log(chalk.cyan('AGENT_PRIVATE_KEY=') + chalk.white(privateKey));
    
    console.log(chalk.yellow('\n⚠️  Important:'));
    console.log(chalk.yellow('1. Store these keys securely'));
    console.log(chalk.yellow('2. Add them to your .env file'));
    console.log(chalk.yellow('3. Never commit them to version control'));
    console.log(chalk.yellow('4. Keep a secure backup of these keys\n'));
    
    process.exit(0);
  } catch (error) {
    logger.error('Failed to generate keys:', error);
    process.exit(1);
  }
}

// CLI command handler
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'generate':
      await generateKeys();
      break;
    default:
      logger.error('Unknown command. Available commands: generate');
      logger.info('\nUsage:');
      logger.info('  yarn keys:generate    - Generate new key pair');
      process.exit(1);
  }
}

main(); 