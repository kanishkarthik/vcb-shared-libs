import { Injectable } from '@angular/core';

export interface AppConfig {
  apiBaseUrl: string;
  i18nBaseUrl: string;
  remotes: Record<string, string>;
}

/**
 * Runtime configuration service.
 * Loads app-config.json at startup before Angular bootstraps routes or HTTP calls.
 * Swap app-config.json per environment at deploy time — no rebuild required.
 *
 * Module Federation note:
 * This service is a singleton shared across all remotes. The host shell loads it
 * first via load(). Remote shells call mergeConfig() to supplement their own
 * remotes without overwriting the host config (e.g. bkt/dft/ops entries needed
 * by payments-shell when running standalone).
 */
@Injectable({
  providedIn: 'root'
})
export class RuntimeConfigService {
  private config: AppConfig = {
    apiBaseUrl: '/api',
    i18nBaseUrl: './assets/i18n/',
    remotes: {}
  };

  private loaded = false;

  /**
   * Load config from the shell's own assets/app-config.json (relative URL).
   * No-op if already loaded by a host shell — the host config takes precedence.
   */
  async load(): Promise<void> {
    if (this.loaded) return;
    const response = await fetch('assets/app-config.json');
    if (!response.ok) {
      throw new Error(`Failed to load runtime config: HTTP ${response.status}`);
    }
    this.config = await response.json();
    this.loaded = true;
  }

  /**
   * Fetch a config from an absolute URL and merge only the remotes that are
   * not already present. Safe to call from a remote shell — never overwrites
   * apiBaseUrl or i18nBaseUrl set by the host.
   */
  async mergeConfig(absoluteUrl: string): Promise<void> {
    const response = await fetch(absoluteUrl);
    if (!response.ok) {
      throw new Error(`Failed to merge remote config from ${absoluteUrl}: HTTP ${response.status}`);
    }
    const partial: Partial<AppConfig> = await response.json();
    if (partial.remotes) {
      this.config = {
        ...this.config,
        remotes: {
          ...partial.remotes,      // remote shell entries first
          ...this.config.remotes   // host entries win on conflict
        }
      };
    }
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  getRemoteUrl(remote: string): string {
    return this.config.remotes?.[remote] ?? '';
  }
}

