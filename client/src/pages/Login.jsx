import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ConnectionSettings from '../components/ConnectionSettings';
import '../styles/Login.css';

function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConnectionSetup, setShowConnectionSetup] = useState(false);
  const isStandalone = typeof window !== 'undefined' && !window.appConfig?.apiBaseUrl;
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatApiError = (err, fallbackMessage) => {
    if (!err) return fallbackMessage;
    if (err.response?.data?.error) return err.response.data.error;
    if (err.request && !err.response) return 'Unable to connect to backend server';
    return err.message || fallbackMessage;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    const trimmedUsername = formData.username.trim();
    const normalizedEmail = formData.email.trim().toLowerCase();

    try {
      const endpoint = isRegister ? '/api/users/register' : '/api/users/login';
      const requestBody = isRegister
        ? { ...formData, username: trimmedUsername, email: normalizedEmail }
        : { username: trimmedUsername, password: formData.password };
      const response = await axios.post(endpoint, requestBody);

      if (isRegister) {
        setSuccessMessage(response.data?.message || 'Registration submitted. Awaiting admin approval.');
        setIsRegister(false);
        setFormData({ username: '', email: '', password: '' });
        return;
      }
      
      const userData = {
        id: response.data.user?.id,
        username: response.data.user?.username,
        email: response.data.user?.email,
        role: response.data.user?.role || 'viewer'
      };

      onLogin(userData, response.data.token);
    } catch (err) {
      setError(formatApiError(err, 'An error occurred'));
      console.error('Login error', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>{isRegister ? 'Register' : 'Login'}</h1>
        
        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label>Username or Email</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Loading...' : isRegister ? 'Register' : 'Login'}
          </button>
        </form>

        <div className="toggle-auth">
          <p>
            {isRegister ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
                setSuccessMessage('');
              }}
            >
              {isRegister ? 'Login' : 'Register'}
            </button>
          </p>
        </div>

        <div className="forget-password">
          <button
            type="button"
            className="forget-password-link"
            onClick={() => navigate('/forget-password')}
          >
            Forget Password
          </button>
        </div>

        <div className="connect-to-server">
          <button
            type="button"
            className="connect-btn"
            onClick={() => setShowConnectionSetup(true)}
          >
            {isStandalone ? 'Not seeing your account? Connect to Server' : 'Switch Server'}
          </button>
        </div>
      </div>

      {showConnectionSetup && (
        <ConnectionSettings onClose={() => setShowConnectionSetup(false)} />
      )}
    </div>
  );
}

export default Login;
