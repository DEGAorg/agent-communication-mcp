// Load environment variables
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Calculate root directory path for finding .env file
// Use let for compatibility with testing environments
let rootDir;

try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  rootDir = path.resolve(__dirname, '..');
} catch (err) {
  // Fallback for test environments that might not support import.meta.url
  rootDir = process.cwd();
}

const envPath = path.join(rootDir, '.env');
console.log('Loading environment variables from:', envPath);

// Load environment variables from .env file if present
// In production, these will be provided by Docker or the host environment
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
} else {
  console.log('Environment variables loaded successfully');
}

// Define required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'AGENT_ID', 'WALLET_MCP_URL'] as const;

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Type-safe config interface
interface Config {
  supabaseUrl: string;
  supabaseAnonKey: string;
  agentId: string;
  walletMcpUrl: string;
  port: number;
  nodeEnv: string;
  logLevel: string;
  logFile?: string;
}

// Create config object with validated environment variables
export const config: Config = {
  // Supabase configuration
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
  agentId: process.env.AGENT_ID!,

  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Logging configuration
  logLevel: process.env.LOG_LEVEL || 'info',
  logFile: process.env.LOG_FILE || undefined,

  // Wallet MCP URL
  walletMcpUrl: process.env.WALLET_MCP_URL!,
} as const;

// Log configuration (without sensitive data)
console.log('Configuration loaded:', {
  hasSupabaseUrl: !!config.supabaseUrl,
  hasSupabaseAnonKey: !!config.supabaseAnonKey,
  agentId: config.agentId,
  port: config.port,
  nodeEnv: config.nodeEnv,
  logLevel: config.logLevel
}); 