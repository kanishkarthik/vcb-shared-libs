import { Injectable, InjectionToken, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type SupportedLanguage = 'en' | 'vi';

/**
 * Configuration for i18n base URL.
 * In a micro-frontend setup, each remote module may have its own assets URL.
 *
 * Example:
 *   - Digital shell: 'http://localhost:4200/assets/i18n/'
 *   - Payments shell: 'http://localhost:4201/assets/i18n/'
 */
export interface TranslationConfig {
  baseUrl: string;
  supportedLanguages?: SupportedLanguage[];
  defaultLanguage?: SupportedLanguage;
  debug?: boolean;
}

/**
 * InjectionToken for providing translation configuration.
 * Apps should provide this during bootstrap.
 */
export const TRANSLATION_CONFIG = new InjectionToken<TranslationConfig>('TRANSLATION_CONFIG');

/**
 * Shared singleton TranslationService used across all shells.
 * Configured with providedIn: 'root' to ensure only one instance exists
 * across the entire module federation setup.
 */
@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private config = inject(TRANSLATION_CONFIG);

  private currentLanguage = new BehaviorSubject<SupportedLanguage>('en');
  private translationData: { [key in SupportedLanguage]?: any } = {};
  private isInitialized = new BehaviorSubject<boolean>(false);
  private mergedRemotes = new Set<string>();

  currentLanguage$ = this.currentLanguage.asObservable();
  isInitialized$ = this.isInitialized.asObservable();

  /**
   * Initialize translations from the configured base URL.
   * Should be called via APP_INITIALIZER before first render.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized.getValue()) {
      return;
    }

    const savedLanguage = localStorage.getItem('app-language') as SupportedLanguage;
    const browserLanguage = navigator.language.split('-')[0] as SupportedLanguage;
    const supported = this.config.supportedLanguages ?? ['en', 'vi'];
    const defaultLang = this.config.defaultLanguage ?? 'en';

    let languageToUse: SupportedLanguage = defaultLang;

    if (savedLanguage && supported.includes(savedLanguage)) {
      languageToUse = savedLanguage;
    } else if (supported.includes(browserLanguage)) {
      languageToUse = browserLanguage;
    }

    await this.loadLanguageData(languageToUse);
    this.currentLanguage.next(languageToUse);
    localStorage.setItem('app-language', languageToUse);
    this.isInitialized.next(true);

    this.log(`Initialized with language: ${languageToUse}`);
  }

  /**
   * Switch to a different language. Preloads the language file if not cached.
   * Notifies all subscribers of the change.
   */
  async setLanguage(language: SupportedLanguage): Promise<void> {
    if (!this.translationData[language]) {
      await this.loadLanguageData(language);
    }

    // Reload all merged remotes for the new language to keep them in sync
    for (const remoteUrl of this.mergedRemotes) {
      await this.mergeLanguageFromRemote(remoteUrl, language);
    }

    this.currentLanguage.next(language);
    localStorage.setItem('app-language', language);
    this.log(`Switched to language: ${language}`);
  }

  /**
   * Load a translation file from the configured base URL.
   */
  private async loadLanguageData(language: SupportedLanguage): Promise<void> {
    const url = `${this.config.baseUrl}${language}.json`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.translationData[language] = await response.json();
      this.log(`Loaded translation: ${url}`);
    } catch (error) {
      console.error(`[TranslationService] Failed to load ${url}:`, error);
      if (language !== 'en' && !this.translationData['en']) {
        await this.loadLanguageData('en');
      }
    }
  }

  /**
   * Merge translations from a remote MFE (e.g., payments shell).
   * Preloads all supported languages so language switching is instant.
   *
   * Remote translations are merged using deep-merge; remote keys never
   * overwrite existing host keys.
   *
   * @param remoteBaseUrl Absolute URL of the remote's i18n folder,
   *   e.g., 'http://localhost:4201/assets/i18n/'
   */
  async mergeRemoteTranslations(remoteBaseUrl: string): Promise<void> {
    this.mergedRemotes.add(remoteBaseUrl);
    const supported = this.config.supportedLanguages ?? ['en', 'vi'];

    // Ensure all supported languages are loaded in the host
    for (const lang of supported) {
      if (!this.translationData[lang]) {
        await this.loadLanguageData(lang);
      }
    }

    // Merge remote translations for all supported languages
    for (const lang of supported) {
      await this.mergeLanguageFromRemote(remoteBaseUrl, lang);
    }

    // Trigger re-evaluation of all translate pipes
    const current = this.currentLanguage.getValue();
    this.currentLanguage.next(current);
    this.log(`Merged remote translations from: ${remoteBaseUrl}`);
  }

  /**
   * Fetch and merge a single language from a remote URL.
   */
  private async mergeLanguageFromRemote(
    remoteUrl: string,
    language: SupportedLanguage
  ): Promise<void> {
    const url = `${remoteUrl}${language}.json`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const remoteData = await response.json();
      this.translationData[language] = this.deepMerge(
        this.translationData[language] ?? {},
        remoteData
      );
      this.log(`Merged remote: ${url}`);
    } catch (error) {
      console.warn(`[TranslationService] Could not load remote ${url}:`, error);
    }
  }

  /**
   * Deep-merge source into target. Target keys take precedence.
   * Remote modules can only ADD keys, not override host keys.
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(result[key] ?? {}, source[key]);
      } else if (!(key in result)) {
        result[key] = source[key];
      }
    }
    return result;
  }

  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage.getValue();
  }

  /**
   * Get translated text using dot notation.
   * Returns the key itself as fallback if not found.
   *
   * Example: getTranslation('payments.bkt.title')
   */
  getTranslation(key: string): string {
    const language = this.getCurrentLanguage();
    const keys = key.split('.');
    let value: any = this.translationData[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`[TranslationService] Key not found: ${key} (${language})`);
        return key;
      }
    }

    return typeof value === 'string' ? value : key;
  }

  /**
   * Reactive Observable for a translation key.
   * Re-emits whenever the language changes.
   */
  getTranslation$(key: string): Observable<string> {
    return new Observable(observer => {
      observer.next(this.getTranslation(key));
      const sub = this.currentLanguage$.subscribe(() => {
        observer.next(this.getTranslation(key));
      });
      return () => sub.unsubscribe();
    });
  }

  getAllTranslations(): any {
    return this.translationData[this.getCurrentLanguage()] || {};
  }

  getSupportedLanguages(): SupportedLanguage[] {
    return this.config.supportedLanguages ?? ['en', 'vi'];
  }

  getLanguageName(language: SupportedLanguage): string {
    const names: { [key in SupportedLanguage]: string } = {
      en: 'English',
      vi: 'Tiếng Việt'
    };
    return names[language];
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[TranslationService] ${message}`);
    }
  }
}
