import { Pipe, PipeTransform } from '@angular/core';
import { TranslationService } from './translation.service';

/**
 * Standalone pipe for translating keys using the shared TranslationService.
 * Usage: {{ 'payments.bkt.title' | translate }}
 */
@Pipe({
  name: 'translate',
  pure: false,
  standalone: true
})
export class TranslatePipe implements PipeTransform {
  constructor(private translationService: TranslationService) {}

  transform(key: string): string {
    return this.translationService.getTranslation(key);
  }
}
