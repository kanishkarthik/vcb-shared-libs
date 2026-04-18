import { Injectable, inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthenticationService } from './authentication.service';
import { TokenService } from './token.service';

/**
 * HTTP Interceptor for handling authentication
 * - Attaches JWT tokens to outgoing requests
 * - Handles 401 Unauthorized responses with token refresh
 * - Implements refresh token queue to prevent multiple refresh calls
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly authService = inject(AuthenticationService);
  private readonly tokenService = inject(TokenService);

  // Queue to handle concurrent token refresh requests
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    // Skip adding token to login/refresh endpoints and public APIs
    if (this.isPublicPath(request)) {
      return next.handle(request);
    }

    // Attach token to request
    const token = this.tokenService.getAccessToken();
    if (token) {
      request = this.addTokenToRequest(request, token);
    }

    return next.handle(request).pipe(
      catchError(error => {
        // Handle 401 Unauthorized
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return this.handle401Error(request, next);
        }

        // Handle 403 Forbidden
        if (error instanceof HttpErrorResponse && error.status === 403) {
          console.error('Access forbidden:', error);
          return throwError(() => new Error('Access denied'));
        }

        // Handle other HTTP errors
        return throwError(() => error);
      })
    );
  }

  /**
   * Add token to request header
   */
  private addTokenToRequest(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  /**
   * Handle 401 Unauthorized error with token refresh
   */
  private handle401Error(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshAccessToken().pipe(
        switchMap((response: any) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(response.accessToken);

          // Retry original request with new token
          return next.handle(this.addTokenToRequest(request, response.accessToken));
        }),
        catchError(error => {
          this.isRefreshing = false;
          return throwError(() => error);
        })
      );
    } else {
      // Wait for token refresh to complete, then retry request
      return this.refreshTokenSubject.pipe(
        filter(token => token !== null),
        take(1),
        switchMap(token => {
          return next.handle(this.addTokenToRequest(request, token!));
        })
      );
    }
  }

  /**
   * Check if request path is public (no token needed)
   */
  private isPublicPath(request: HttpRequest<any>): boolean {
    const url = request.url.toLowerCase();
    const publicPaths = [
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/logout',
      '/api/v1/auth/register',
      '/assets/',
      'https://',
      'http://'
    ];

    return publicPaths.some(path => url.includes(path.toLowerCase()));
  }
}
