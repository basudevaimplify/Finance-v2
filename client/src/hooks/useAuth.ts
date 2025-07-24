import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Initialize authentication state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for stored token
        const storedToken = localStorage.getItem('access_token');
        if (storedToken) {
          setToken(storedToken);

          // Try to get user info with the stored token
          try {
            const userData = await apiRequest('/api/auth/user');
            setUser(userData);
          } catch (error) {
            // Token might be invalid, clear it
            localStorage.removeItem('access_token');
            setToken(null);
          }
        } else {
          // Auto-login with demo credentials for seamless experience
          await autoLogin();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setError('Authentication initialization failed');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const autoLogin = async () => {
    try {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password'
        })
      });

      if (response.token && response.user) {
        setToken(response.token);
        setUser(response.user);
        localStorage.setItem('access_token', response.token);
        queryClient.setQueryData(["/api/auth/user"], response.user);
      }
    } catch (error) {
      console.error('Auto-login failed:', error);
      setError('Auto-login failed');
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (response.token && response.user) {
        setToken(response.token);
        setUser(response.user);
        localStorage.setItem('access_token', response.token);
        queryClient.setQueryData(["/api/auth/user"], response.user);
      }
    } catch (error: any) {
      setError(error.message || 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setToken(null);
      setUser(null);
      localStorage.removeItem('access_token');
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  console.log('useAuth state:', {
    isLoading,
    token: token?.substring(0, 20) + '...',
    hasUser: !!user,
    isAuthenticated: !!token && !!user
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!token && !!user,
    login,
    logout,
    token,
    error
  };
}