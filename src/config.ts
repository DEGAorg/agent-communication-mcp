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

export const config = {
  // Supabase configuration
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',

  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Logging configuration
  logLevel: process.env.LOG_LEVEL || 'info',
  logFile: process.env.LOG_FILE || undefined,
} as const;

// Log configuration (without sensitive data)
console.log('Configuration loaded:', {
  hasSupabaseUrl: !!config.supabaseUrl,
  hasSupabaseAnonKey: !!config.supabaseAnonKey,
  port: config.port,
  nodeEnv: config.nodeEnv,
  logLevel: config.logLevel
});

// Validate required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
} 