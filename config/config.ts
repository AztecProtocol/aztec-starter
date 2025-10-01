import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

// Load .env file if it exists (for secrets like API keys)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface NetworkConfig {
  nodeUrl: string;
  l1RpcUrl: string;
  l1ChainId: number;
}

export interface TimeoutConfig {
  deployTimeout: number;
  txTimeout: number;
  waitTimeout: number;
}

export interface EnvironmentConfig {
  name: string;
  environment: 'local' | 'testnet' | 'mainnet';
  network: NetworkConfig;
  settings: {
    skipSandbox: boolean;
    version: string;
  };
  timeouts?: TimeoutConfig;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config!: EnvironmentConfig;
  private configPath: string;

  private constructor() {
    const env = process.env.AZTEC_ENV || 'sandbox';
    this.configPath = path.resolve(process.cwd(), `config/${env}.json`);
    this.loadConfig();
    console.log(`Loaded configuration: ${this.config.name} environment`);
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): void {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
    } catch (error) {
      console.error(`Failed to load config from ${this.configPath}:`, error);
      throw new Error('Configuration file not found or invalid');
    }
  }

  public getConfig(): EnvironmentConfig {
    return this.config;
  }

  public getNetworkConfig(): NetworkConfig {
    return this.config.network;
  }

  public isTestnet(): boolean {
    return this.config.environment === 'testnet';
  }

  public isSandbox(): boolean {
    return this.config.environment === 'local';
  }

  public getNodeUrl(): string {
    return this.config.network.nodeUrl;
  }

  public getL1RpcUrl(): string {
    return this.config.network.l1RpcUrl;
  }

  /**
   * Gets timeout values from configuration, with fallback defaults.
   */
  public getTimeouts(): TimeoutConfig {
    // If timeouts are defined in config, use them
    if (this.config.timeouts) {
      return this.config.timeouts;
    }
    
    // Otherwise, use defaults based on environment
    if (this.isTestnet()) {
      return {
        deployTimeout: 1200000, // 20 minutes
        txTimeout: 180000,     // 3 minutes
        waitTimeout: 60000     // 1 minute
      };
    }
    
    return {
      deployTimeout: 120000, // 2 minutes
      txTimeout: 60000,      // 1 minute
      waitTimeout: 30000     // 30 seconds
    };
  }
}

// Create singleton instance and export convenience functions
const configManager = ConfigManager.getInstance();

/**
 * Gets the node URL from configuration.
 */
export function getAztecNodeUrl(): string {
  return configManager.getNodeUrl();
}

/**
 * Gets the L1 RPC URL from configuration.
 */
export function getL1RpcUrl(): string {
  return configManager.getL1RpcUrl();
}

/**
 * Gets the current environment name.
 */
export function getEnv(): string {
  return configManager.getConfig().name;
}

/**
 * Gets timeout values based on environment.
 */
export function getTimeouts(): TimeoutConfig {
  return configManager.getTimeouts();
}

// Export the singleton instance for direct access if needed
export default configManager;