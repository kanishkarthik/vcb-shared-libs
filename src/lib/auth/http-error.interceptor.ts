import { Injectable, inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
  HttpResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ErrorHandlingService } from './error-handling.service';

/**
 * Enhanced HTTP Error Interceptor
 * Handles error responses and provides detailed error information
 * Can be added alongside AuthInterceptor for complete HTTP handling
 *
 * Usage: Add to providers in app.config.ts
 * {
 *   provide: HTTP_INTERCEPTORS,
 *   useClass: HttpErrorInterceptor,
 *   multi: true
 * }
 */
@Injectable()
export class HttpErrorInterceptor {
  private readonly errorHandlingService = inject(ErrorHandlingService);

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      tap(event => {
        // Log successful responses (optional)
        if (event instanceof HttpResponse) {
          this.logResponse(request, event);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        return throwError(() => this.handleError(request, error));
      })
    );
  }

  private handleError(request: HttpRequest<any>, error: HttpErrorResponse): Error {
    let errorMessage = '';

    // Determine error type and message
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 400:
          errorMessage = `Bad Request: ${error.error?.message || 'Invalid request data'}`;
          break;
        case 401:
          errorMessage = 'Unauthorized: Please login again';
          break;
        case 403:
          errorMessage = 'Forbidden: You do not have permission';
          break;
        case 404:
          errorMessage = `Not Found: ${request.url}`;
          break;
        case 409:
          errorMessage = `Conflict: ${error.error?.message || 'Resource conflict'}`;
          break;
        case 422:
          errorMessage = `Unprocessable Entity: ${this.formatValidationErrors(error)}`;
          break;
        case 500:
          errorMessage = 'Server Error: Please try again later';
          break;
        case 502:
          errorMessage = 'Bad Gateway: Server temporarily unavailable';
          break;
        case 503:
          errorMessage = 'Service Unavailable: Server is under maintenance';
          break;
        case 0:
          errorMessage = 'Network Error: Unable to reach the server';
          break;
        default:
          errorMessage = `HTTP Error ${error.status}: ${error.statusText}`;
      }
    }

    // Log error with context
    this.errorHandlingService.logHttpError(
      {
        status: error.status,
        message: errorMessage,
        error: error.error
      },
      request.url
    );

    return new Error(errorMessage);
  }

  private formatValidationErrors(error: HttpErrorResponse): string {
    const errors = error.error?.errors;
    if (Array.isArray(errors)) {
      return errors.map(e => `${e.field}: ${e.message}`).join(', ');
    }
    return error.error?.message || 'Validation failed';
  }

  private logResponse(request: HttpRequest<any>, response: HttpResponse<any>): void {
    console.debug(`[HTTP] ${request.method} ${request.url} - ${response.status}`);
  }
}
