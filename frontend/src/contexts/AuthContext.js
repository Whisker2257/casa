// /Users/nashe/casa/frontend/src/contexts/AuthContext.js
import React, { createContext, useState } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('casa_token'));
  const [user,  setUser]  = useState(
    JSON.parse(localStorage.getItem('casa_user') || 'null')
  );

  const login = (tok, usr) => {
    localStorage.setItem('casa_token', tok);
    localStorage.setItem('casa_user',  JSON.stringify(usr));
    setToken(tok);
    setUser(usr);
  };

  const logout = () => {
    localStorage.removeItem('casa_token');
    localStorage.removeItem('casa_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
