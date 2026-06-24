import React, { useState } from 'react';
import axios from 'axios';
import '../styles/ChangePassword.css';

function EyeIcon({ isVisible }) {
  if (isVisible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7a11.8 11.8 0 01-4.24 5.19M6.53 6.53A12.47 12.47 0 001 12c1.73 3.89 6 7 11 7 1.55 0 3.03-.3 4.38-.85"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ChangePassword({ user, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    repeat: false,
  });

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const getInitials = (username) => {
    const normalizedName = (username || '').trim();
    if (!normalizedName) {
      return 'NA';
    }
    const nameParts = normalizedName
      .split(/[\s._-]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
    }
    return normalizedName.slice(0, 2).toUpperCase();
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!currentPassword || !newPassword || !repeatPassword) {
      setError('All fields are required');
      return;
    }

    if (newPassword !== repeatPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await axios.post(
        '/api/users/change-password',
        {
          currentPassword,
          newPassword,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessage(response.data.message || 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-modal-overlay" onClick={onClose}>
      <div className="change-password-modal" onClick={(e) => e.stopPropagation()}>
        <div className="change-password-header">
          <div className="change-password-avatar">{getInitials(user?.username)}</div>
          <h3>Change Password</h3>
          <button type="button" className="change-password-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleChangePassword} className="change-password-form">
          {error && <div className="change-password-error">{error}</div>}
          {message && <div className="change-password-success">{message}</div>}

          <div className="form-group">
            <label htmlFor="current-password">Current Password</label>
            <div className="password-input-wrapper">
              <input
                id="current-password"
                type={showPasswords.current ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                disabled={loading}
              />
              <button
                type="button"
                className="password-visibility-toggle"
                onClick={() => togglePasswordVisibility('current')}
                aria-label={showPasswords.current ? 'Hide current password' : 'Show current password'}
                aria-pressed={showPasswords.current}
                disabled={loading}
              >
                <EyeIcon isVisible={showPasswords.current} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="new-password">New Password</label>
            <div className="password-input-wrapper">
              <input
                id="new-password"
                type={showPasswords.next ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={loading}
              />
              <button
                type="button"
                className="password-visibility-toggle"
                onClick={() => togglePasswordVisibility('next')}
                aria-label={showPasswords.next ? 'Hide new password' : 'Show new password'}
                aria-pressed={showPasswords.next}
                disabled={loading}
              >
                <EyeIcon isVisible={showPasswords.next} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="repeat-password">Repeat New Password</label>
            <div className="password-input-wrapper">
              <input
                id="repeat-password"
                type={showPasswords.repeat ? 'text' : 'password'}
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                placeholder="Repeat new password"
                disabled={loading}
              />
              <button
                type="button"
                className="password-visibility-toggle"
                onClick={() => togglePasswordVisibility('repeat')}
                aria-label={showPasswords.repeat ? 'Hide repeated new password' : 'Show repeated new password'}
                aria-pressed={showPasswords.repeat}
                disabled={loading}
              >
                <EyeIcon isVisible={showPasswords.repeat} />
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-change-password" disabled={loading}>
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChangePassword;
