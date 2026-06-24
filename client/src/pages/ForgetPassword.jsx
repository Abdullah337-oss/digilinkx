import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/ForgetPassword.css';

function ForgetPassword() {
  const [step, setStep] = useState(1); // 1: Email, 2: Code, 3: New Password
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const formatApiError = (err, fallbackMessage) => {
    const apiError = err.response?.data;

    if (apiError?.details) {
      return `${apiError.error} (${apiError.details})`;
    }

    return apiError?.error || fallbackMessage;
  };

  const handleGetCode = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await axios.post('/api/users/forget-password', { email });
      setMessage(response.data?.message || 'Verification code sent to your email');
      setStep(2);
    } catch (err) {
      setError(formatApiError(err, 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await axios.post('/api/users/verify-reset-code', { email, code });
      setMessage('Code verified! Now set your new password.');
      setStep(3);
    } catch (err) {
      setError(formatApiError(err, 'Invalid code'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await axios.post('/api/users/reset-password', {
        email,
        code,
        newPassword,
        confirmPassword,
      });
      setMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(formatApiError(err, 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forget-password-container">
      <div className="forget-password-card">
        <h1>Forget password</h1>

        <p className="instruction-text">
          To restore the password place your email in the section for code
        </p>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        {/* Step 1: Email Input */}
        {step === 1 && (
          <form onSubmit={handleGetCode}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Loading...' : 'Get Code'}
            </button>
          </form>
        )}

        {/* Step 2: Code Verification */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode}>
            <div className="form-group">
              <label>Enter 6-Digit Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.slice(0, 6))}
                placeholder="000000"
                maxLength="6"
                required
                disabled={loading}
              />
            </div>

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>

            <button
              type="button"
              className="back-btn"
              onClick={() => {
                setStep(1);
                setCode('');
                setMessage('');
              }}
              disabled={loading}
            >
              Back
            </button>
          </form>
        )}

        {/* Step 3: New Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                disabled={loading}
              />
            </div>

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Saving...' : 'Save New Password'}
            </button>

            <button
              type="button"
              className="back-btn"
              onClick={() => {
                setStep(2);
                setNewPassword('');
                setConfirmPassword('');
                setMessage('');
              }}
              disabled={loading}
            >
              Back
            </button>
          </form>
        )}

        <div className="back-to-login">
          <button
            type="button"
            className="link-btn"
            onClick={() => navigate('/login')}
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default ForgetPassword;
