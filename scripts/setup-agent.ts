#!/usr/bin/env node
import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { FileManager, FileType } from '../src/utils/file-manager.js';
import { KeyPairGenerator } from '../src/cli/keys.js';
import chalk from 'chalk';

program
  .name('setup-agent')
  .description('Set up a new agent with encryption keys')
  .requiredOption('-a, --agent-id <id>', 'Agent ID (e.g., agent-123)')
  .option('-d, --dir <path>', 'Project root directory (default: current directory)', '.')
  .parse(process.argv);

const options = program.opts();

async function createEncryptionDirectory(projectRoot: string): Promise<void> {
  // Check if project root exists
  if (!fs.existsSync(projectRoot)) {
    throw new Error(`Project root directory not found: ${projectRoot}`);
  }

  const storageDir = path.join(projectRoot, '.storage');
  
  // Create .storage directory if it doesn't exist
  if (!fs.existsSync(storageDir)) {
    console.log(chalk.cyan('Creating .storage directory...'));
    fs.mkdirSync(storageDir, { recursive: true, mode: 0o755 });
  }

  const fileManager = FileManager.getInstance({ baseDir: storageDir });
  
  // Create all required directories
  const directories = [
    FileType.ENCRYPTION,
    FileType.SERVICE_CONTENT,
    FileType.RECEIVED_CONTENT
  ];

  for (const dirType of directories) {
    const dirPath = fileManager.getPath(dirType, '');
    try {
      fileManager.ensureDirectoryExists(dirPath);
      console.log(chalk.cyan(`Created ${dirType} directory...`));
    } catch (error) {
      console.error(chalk.red(`Failed to create ${dirType} directory ${dirPath}:`), error);
      throw error;
    }
  }
}

async function generateAndSaveKeys(agentId: string, projectRoot: string): Promise<void> {
  try {
    // Generate key pair using the KeyPairGenerator class
    const { publicKey, privateKey } = KeyPairGenerator.generateKeyPair();
    const storageDir = path.join(projectRoot, '.storage');
    const fileManager = FileManager.getInstance({ baseDir: storageDir });
    
    // Get encryption directory path
    const encryptionDir = fileManager.getPath(FileType.ENCRYPTION, '');
    
    // Create agent-specific directory
    const agentDir = path.join(encryptionDir, agentId);
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true, mode: 0o700 });
    }

    // Save keys to files
    const publicKeyPath = path.join(agentDir, 'public.key');
    const privateKeyPath = path.join(agentDir, 'private.key');

    fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o600 });
    fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });

    console.log(chalk.green('\n✅ Encryption keys generated and saved successfully!'));
    console.log(chalk.yellow('\nKey files:'));
    console.log(chalk.white(`Public key: ${publicKeyPath}`));
    console.log(chalk.white(`Private key: ${privateKeyPath}`));
  } catch (error) {
    console.error(chalk.red('\nError: Failed to generate and save keys:'));
    console.error(chalk.red(error));
    throw error;
  }
}

async function main() {
  try {
    const projectRoot = path.resolve(options.dir);
    const agentId = options.agentId;

    // Validate agent ID format
    if (!/^[a-zA-Z0-9-]+$/.test(agentId)) {
      throw new Error('Agent ID can only contain letters, numbers, and hyphens');
    }

    // Create encryption directory
    console.log(chalk.cyan('\nCreating encryption directory...'));
    await createEncryptionDirectory(projectRoot);

    // Generate and save encryption keys
    console.log(chalk.cyan('\nGenerating encryption keys...'));
    await generateAndSaveKeys(agentId, projectRoot);

    console.log('\n' + chalk.green('✅ Agent setup completed successfully!'));
    console.log('\n' + chalk.yellow('IMPORTANT:'));
    console.log(chalk.yellow('1. Keep your encryption keys secure and never share them'));
    console.log(chalk.yellow('2. Make sure to backup your keys securely'));
    console.log(chalk.yellow('3. The private key file has restricted permissions (600)'));

  } catch (error) {
    console.error(chalk.red('\nError: Failed to set up agent:'));
    console.error(chalk.red(error));
    process.exit(1);
  }
}

main();
