import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AppError {
  code: string;
  message: string;
  timestamp: Date;
  details?: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Centralized error handling service
 * Provides consistent error handling and logging across the application
 */
@Injectable({
  providedIn: 'root'
})
export class ErrorHandlingService {
  private errorSubject = new BehaviorSubject<AppError | null>(null);
  public error$ = this.errorSubject.asObservable();

  private errorHistorySubject = new BehaviorSubject<AppError[]>([]);
  public errorHistory$ = this.errorHistorySubject.asObservable();

  private readonly MAX_ERROR_HISTORY = 50;

  constructor() {}

  /**
   * Log a general error
   */
  logError(error: any, sourceContext?: string, severity: 'info' | 'warning' | 'error' | 'critical' = 'error'): AppError {
    const appError: AppError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: this.extractErrorMessage(error),
      timestamp: new Date(),
      details: {
        source: sourceContext,
        originalError: error
      },
      severity
    };

    this.addToHistory(appError);
    console.error(`[${sourceContext || 'APP'}] ${appError.message}`, error);

    return appError;
  }

  /**
   * Log authentication error
   */
  logAuthError(error: any): AppError {
    return this.logError(error, 'AuthenticationService', 'critical');
  }

  /**
   * Log HTTP error
   */
  logHttpError(error: any, endpoint?: string): AppError {
    return this.logError(error, `HTTP[${endpoint || 'UNKNOWN'}]`, 'error');
  }

  /**
   * Log validation error
   */
  logValidationError(fieldName: string, message: string): AppError {
    const error: AppError = {
      code: 'VALIDATION_ERROR',
      message,
      timestamp: new Date(),
      details: { fieldName },
      severity: 'warning'
    };

    this.addToHistory(error);
    return error;
  }

  /**
   * Clear current error
   */
  clearError(): void {
    this.errorSubject.next(null);
  }

  /**
   * Get error history
   */
  getErrorHistory(): AppError[] {
    return this.errorHistorySubject.value;
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistorySubject.next([]);
  }

  /**
   * Get latest error
   */
  getLatestError(): AppError | null {
    return this.errorSubject.value;
  }

  /**
   * Extract message from various error types
   */
  private extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error?.error?.message) {
      return error.error.message;
    }

    if (error?.message) {
      return error.message;
    }

    if (error?.status) {
      return `HTTP Error ${error.status}: ${error.statusText || 'Unknown'}`;
    }

    return 'An unexpected error occurred';
  }

  /**
   * Add error to history
   */
  private addToHistory(error: AppError): void {
    const history = this.errorHistorySubject.value;
    history.push(error);

    // Keep only last N errors
    if (history.length > this.MAX_ERROR_HISTORY) {
      history.shift();
    }

    this.errorHistorySubject.next([...history]);
    this.errorSubject.next(error);
  }

  /**
   * Format error for user display
   */
  getUserFriendlyMessage(error: any): string {
    const message = this.extractErrorMessage(error);

    const friendlyMessages: { [key: string]: string } = {
      'VALIDATION_ERROR': 'Please check your input and try again',
      'NETWORK_ERROR': 'Network connection error. Please check your internet connection',
      'UNAUTHORIZED': 'Session expired. Please login again',
      'FORBIDDEN': 'You do not have permission to perform this action',
      'NOT_FOUND': 'The requested resource was not found',
      'SERVER_ERROR': 'Server error occurred. Please try again later',
      'TIMEOUT': 'Request timeout. Please try again'
    };

    return friendlyMessages[message] || message;
  }
}
