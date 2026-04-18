import { Injectable } from '@angular/core';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRY_KEY = 'token_expiry';
const USER_KEY = 'user_data';

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Enterprise-grade token storage service
 * Handles secure storage and retrieval of authentication tokens
 */
@Injectable({
  providedIn: 'root'
})
export class TokenService {

  constructor() {}

  /**
   * Save tokens to localStorage
   */
  saveTokens(tokens: StoredToken): void {
    try {
      const expiresAt = Date.now() + (tokens.expiresIn * 1000);
      localStorage.setItem(TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString());
      localStorage.setItem(USER_KEY, JSON.stringify(tokens));

      if (tokens.refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      }
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  }

  /**
   * Retrieve access token
   */
  getAccessToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error retrieving access token:', error);
      return null;
    }
  }

  /**
   * Retrieve refresh token
   */
  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error retrieving refresh token:', error);
      return null;
    }
  }

  /**
   * Check if token exists and is not expired
   */
  hasValidToken(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiry) return false;

    return Date.now() < parseInt(expiry, 10);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(): boolean {
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiry) return true;

    return Date.now() >= parseInt(expiry, 10);
  }

  /**
   * Get time until token expires (in seconds)
   */
  getTokenExpiresIn(): number {
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiry) return -1;

    const expiresIn = parseInt(expiry, 10) - Date.now();
    return expiresIn > 0 ? Math.floor(expiresIn / 1000) : -1;
  }

  /**
   * Clear all stored tokens
   */
  clearTokens(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  /**
   * Get stored user data
   */
  getUserData(): any {
    try {
      const userData = localStorage.getItem(USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error retrieving user data:', error);
      return null;
    }
  }
}
