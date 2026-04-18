import { Injectable, inject } from '@angular/core';
import {
  Router,
  CanActivateFn,
  CanActivateChildFn,
  CanDeactivateFn,
  ActivatedRoute,
  ActivatedRouteSnapshot,
  RouterStateSnapshot
} from '@angular/router';
import { map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { AuthenticationService } from './authentication.service';
import { TokenService } from './token.service';

/**
 * Guard that protects routes requiring authentication
 * Redirects to login if user is not authenticated
 *
 * Usage in routes:
 * {
 *   path: 'dashboard',
 *   component: DashboardComponent,
 *   canActivate: [authenticationGuard]
 * }
 */
export const authenticationGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthenticationService);
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (tokenService.hasValidToken() && authService.isAuthenticated()) {
    return true;
  }

  // Store the attempted URL for redirecting after login
  sessionStorage.setItem('redirectUrl', state.url);

  router.navigate(['/login']);
  return false;
};

/**
 * Guard that protects routes for unauthenticated users
 * Redirects to dashboard if user is already authenticated (for login page)
 *
 * Usage in routes:
 * {
 *   path: 'login',
 *   component: LoginComponent,
 *   canActivate: [noAuthenticationGuard]
 * }
 */
export const noAuthenticationGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthenticationService);
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (!tokenService.hasValidToken() || !authService.isAuthenticated()) {
    return true;
  }

  // User is already authenticated, redirect to dashboard
  router.navigate(['/dashboard']);
  return false;
};

/**
 * Guard that checks if user has required roles
 * Can be used with data in routes: { data: { roles: ['ADMIN', 'MANAGER'] } }
 *
 * Usage in routes:
 * {
 *   path: 'admin',
 *   component: AdminComponent,
 *   canActivate: [authenticationGuard, roleGuard],
 *   data: { roles: ['ADMIN'] }
 * }
 */
export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthenticationService);
  const router = inject(Router);

  const requiredRoles = route.data['roles'] as string[];

  if (!requiredRoles || requiredRoles.length === 0) {
    return true; // No roles specified, allow access
  }

  if (authService.hasAnyRole(requiredRoles)) {
    return true;
  }

  console.warn(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
  router.navigate(['/access-denied']);
  return false;
};

/**
 * Guard for routes that should not be deactivated without confirmation
 * Useful for forms with unsaved changes
 *
 * Usage in component:
 * class MyComponent implements CanComponentDeactivate {
 *   canDeactivate(): boolean {
 *     return this.hasUnsavedChanges ? confirm(...) : true;
 *   }
 * }
 *
 * Then in routes: canDeactivate: [canDeactivateGuard]
 */
export interface CanComponentDeactivate {
  canDeactivate: () => Observable<boolean> | Promise<boolean> | boolean;
}

export const canDeactivateGuard: CanDeactivateFn<CanComponentDeactivate> = (
  component: CanComponentDeactivate
) => {
  return component.canDeactivate ? component.canDeactivate() : true;
};

/**
 * Guard that protects child routes
 * Used for lazy-loaded modules with authentication checks
 *
 * Usage in routes:
 * {
 *   path: 'payments',
 *   canActivateChild: [authenticationChildGuard],
 *   children: [...]
 * }
 */
export const authenticationChildGuard: CanActivateChildFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthenticationService);
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (tokenService.hasValidToken() && authService.isAuthenticated()) {
    return true;
  }

  sessionStorage.setItem('redirectUrl', state.url);
  router.navigate(['/login']);
  return false;
};

/**
 * Advanced guard with role-based access and custom logic
 * Combines authentication and authorization checks
 */
@Injectable({
  providedIn: 'root'
})
export class AdvancedAuthGuard {
  constructor(
    private authService: AuthenticationService,
    private tokenService: TokenService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Check authentication
    if (!this.tokenService.hasValidToken()) {
      sessionStorage.setItem('redirectUrl', state.url);
      this.router.navigate(['/login']);
      return new Observable(obs => {
        obs.next(false);
        obs.complete();
      });
    }

    // Check authorization (roles)
    const requiredRoles = route.data['roles'] as string[];
    if (requiredRoles && !this.authService.hasAnyRole(requiredRoles)) {
      console.warn(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
      this.router.navigate(['/access-denied']);
      return new Observable(obs => {
        obs.next(false);
        obs.complete();
      });
    }

    return new Observable(obs => {
      obs.next(true);
      obs.complete();
    });
  }
}
