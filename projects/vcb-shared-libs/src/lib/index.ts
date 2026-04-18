/**
 * Public API for @vcb/shared-libs
 * 
 * Singleton TranslationService and TranslatePipe for use in all shells.
 * Configure with TRANSLATION_CONFIG at bootstrap.
 */

export { TranslationService, TRANSLATION_CONFIG, type  TranslationConfig, type SupportedLanguage } from './translation.service';
export { TranslatePipe } from './translate.pipe';
