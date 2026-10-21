import { createContext, useContext, useEffect, useState } from 'react';
import { api, getErrorMessage } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('smart_retail_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('smart_retail_user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function persistSession(nextUser, nextToken) {
    localStorage.setItem('smart_retail_token', nextToken);
    localStorage.setItem('smart_retail_user', JSON.stringify(nextUser));
    setUser(nextUser);
    setToken(nextToken);
  }

  async function login(email, password) {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      persistSession(data.user, data.token);
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  async function register(name, email, password) {
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      persistSession(data.user, data.token);
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  function logout() {
    localStorage.removeItem('smart_retail_token');
    localStorage.removeItem('smart_retail_user');
    localStorage.removeItem('smart_retail_cart');
    setUser(null);
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
