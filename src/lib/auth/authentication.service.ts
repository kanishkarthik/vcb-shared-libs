import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError, interval } from 'rxjs';
import { tap, catchError, switchMap, take, filter } from 'rxjs/operators';
import { TokenService, StoredToken } from './token.service';

export interface UserCredentials {
  userId: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Enterprise-grade authentication service
 * Handles user authentication, token management, and session state
 */
@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  private readonly httpClient = inject(HttpClient);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  // API endpoint - change based on environment
  private apiUrl = '/api/v1/auth';

  // State management using signals
  private userSignal = signal<UserInfo | null>(null);
  private isAuthenticatedSignal = signal<boolean>(false);
  private isLoadingSignal = signal<boolean>(false);

  // Computed signals for template usage
  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = this.isAuthenticatedSignal.asReadonly();
  readonly isLoading = this.isLoadingSignal.asReadonly();

  // Fallback to BehaviorSubject for more advanced RxJS interactions
  private authStatusSubject = new BehaviorSubject<boolean>(this.tokenService.hasValidToken());
  public authStatus$ = this.authStatusSubject.asObservable();

  constructor() {
    this.initializeAuthState();
    this.setupTokenRefreshTimer();
  }

  /**
   * Initialize auth state from stored tokens
   */
  private initializeAuthState(): void {
    if (this.tokenService.hasValidToken()) {
      const userData = this.tokenService.getUserData();
      if (userData?.user) {
        this.userSignal.set(userData.user);
        this.isAuthenticatedSignal.set(true);
        this.authStatusSubject.next(true);
      }
    }
  }

  /**
   * Login with user credentials
   */
  login(credentials: UserCredentials): Observable<AuthResponse> {
    this.isLoadingSignal.set(true);

    return this.httpClient.post<AuthResponse>(
      `${this.apiUrl}/login`,
      credentials
    ).pipe(
      tap(response => {
        this.handleAuthSuccess(response);
      }),
      catchError(error => {
        this.isLoadingSignal.set(false);
        return throwError(() => this.handleAuthError(error));
      })
    );
  }

  /**
   * Logout - clear tokens and reset state
   */
  logout(): Observable<void> {
    return this.httpClient.post<void>(`${this.apiUrl}/logout`, {}).pipe(
      tap(() => {
        this.clearAuthState();
        this.router.navigate(['/login']);
      }),
      catchError(() => {
        // Even if logout API fails, clear local state
        this.clearAuthState();
        this.router.navigate(['/login']);
        return throwError(() => new Error('Logout failed'));
      })
    );
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(): Observable<AuthResponse> {
    const refreshToken = this.tokenService.getRefreshToken();

    if (!refreshToken) {
      this.clearAuthState();
      return throwError(() => new Error('No refresh token available'));
    }

    return this.httpClient.post<AuthResponse>(
      `${this.apiUrl}/refresh`,
      { refreshToken } as RefreshTokenRequest
    ).pipe(
      tap(response => {
        this.handleAuthSuccess(response);
      }),
      catchError(error => {
        this.clearAuthState();
        this.router.navigate(['/login']);
        return throwError(() => error);
      })
    );
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: string): boolean {
    return this.userSignal()?.roles?.includes(role) ?? false;
  }

  /**
   * Check if user has any of the provided roles
   */
  hasAnyRole(roles: string[]): boolean {
    const userRoles = this.userSignal()?.roles ?? [];
    return roles.some(role => userRoles.includes(role));
  }

  /**
   * Check if user has all provided roles
   */
  hasAllRoles(roles: string[]): boolean {
    const userRoles = this.userSignal()?.roles ?? [];
    return roles.every(role => userRoles.includes(role));
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.tokenService.getAccessToken();
  }

  /**
   * Get observable for current user
   */
  getCurrentUser$(): Observable<UserInfo | null> {
    return new Observable(observer => {
      observer.next(this.userSignal());
      const unwatch = () => observer.complete();
      // Return unsubscribe function
      return () => unwatch();
    });
  }

  /**
   * Handle successful authentication
   */
  private handleAuthSuccess(response: AuthResponse): void {
    // Store tokens
    this.tokenService.saveTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresIn: response.expiresIn,
      tokenType: response.tokenType
    });

    // Update state
    this.userSignal.set(response.user);
    this.isAuthenticatedSignal.set(true);
    this.isLoadingSignal.set(false);
    this.authStatusSubject.next(true);
  }

  /**
   * Clear authentication state
   */
  private clearAuthState(): void {
    this.tokenService.clearTokens();
    this.userSignal.set(null);
    this.isAuthenticatedSignal.set(false);
    this.isLoadingSignal.set(false);
    this.authStatusSubject.next(false);
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: HttpErrorResponse): any {
    let errorMessage = 'An error occurred during authentication';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Backend error
      if (error.status === 401) {
        errorMessage = 'Invalid credentials';
      } else if (error.status === 403) {
        errorMessage = 'Access denied';
      } else if (error.status === 0) {
        errorMessage = 'Network error - unable to connect to server';
      } else {
        errorMessage = error.error?.message || `Server error: ${error.status}`;
      }
    }

    return new Error(errorMessage);
  }

  /**
   * Setup automatic token refresh before expiration
   * Refreshes token when 5 minutes or less remain
   */
  private setupTokenRefreshTimer(): void {
    // Check every minute for token expiration
    interval(60000).subscribe(() => {
      const expiresIn = this.tokenService.getTokenExpiresIn();

      // If token expires in 5 minutes or less, refresh it
      if (expiresIn > 0 && expiresIn <= 300) {
        this.refreshAccessToken()
          .pipe(take(1))
          .subscribe({
            error: () => console.warn('Automatic token refresh failed')
          });
      } else if (expiresIn <= 0) {
        // Token expired
        this.clearAuthState();
        this.router.navigate(['/login']);
      }
    });
  }

  /**
   * Simulate login for demo purposes (remove in production)
   * This will be replaced by actual API call above
   */
  simulateLogin(credentials: UserCredentials): Observable<AuthResponse> {
    this.isLoadingSignal.set(true);

    return new Observable(observer => {
      setTimeout(() => {
        if (credentials.userId && credentials.password.length >= 6) {
          const response: AuthResponse = {
            accessToken: `jwt_token_${Date.now()}`,
            refreshToken: `refresh_token_${Date.now()}`,
            expiresIn: 3600, // 1 hour
            tokenType: 'Bearer',
            user: {
              id: credentials.userId,
              email: `${credentials.userId}@banking.app`,
              fullName: credentials.userId.toUpperCase(),
              roles: ['USER', 'PAYMENTS_VIEW', 'ACCOUNTS_VIEW', 'CLIENTS_VIEW']
            }
          };
          this.handleAuthSuccess(response);
          observer.next(response);
          observer.complete();
        } else {
          observer.error(new Error('Invalid credentials'));
        }
      }, 1500);
    });
  }
}
