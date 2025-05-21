export const DEFAULT_COMMAND_TIMEOUT = 30000; // 30 seconds
export const DEFAULT_CLAUDE_TIMEOUT = 1800000; // 30 minutes

// Create a simple config manager
export interface ConfigManagerInterface {
  getConfig: () => Promise<Config>;
}

export interface Config {
  defaultShell: string | boolean;
}

// Simple config manager implementation
class ConfigManager implements ConfigManagerInterface {
  async getConfig(): Promise<Config> {
    return {
      defaultShell: true
    };
  }
}

export const configManager = new ConfigManager();