import React, { createContext, useState, useEffect, ReactNode } from 'react';
import API from '../services/api';

interface User {
  _id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (userData: any) => void;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const res = await API.get('/auth/me');
          setUser(res.data);
        } catch {
          logout();
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, [token]);

  const login = (data: { _id: string; name: string; email: string; token: string }) => {
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser({ _id: data._id, name: data.name, email: data.email });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};