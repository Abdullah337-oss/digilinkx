import React, { useState, memo } from 'react';
import axios from 'axios';
import '../styles/AddMember.css';

function EyeIcon({ isVisible }) {
  if (isVisible) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function AddMember({ onClose, onNotify }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('viewer'); // internally 'viewer' maps to normal user
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddMember = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();

    if (!trimmedEmail || !trimmedUsername || !password) {
      setError('All fields are required');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const normalizedEmail = trimmedEmail.toLowerCase();

      const response = await axios.post(
        '/api/users/add-member',
        {
          username: trimmedUsername,
          email: normalizedEmail,
          password,
          role,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const successMsg = response.data.message || 'Member added successfully!';
      setSuccess(successMsg);
      if (onNotify) {
        onNotify('Member Added', `${trimmedUsername} was successfully added as an ${role === 'admin' ? 'admin' : 'user'}.`);
      }

      // Reset form
      setEmail('');
      setUsername('');
      setPassword('');
      setRole('viewer');

      // Auto close after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-member-modal-overlay">
      <div className="add-member-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-member-header">
          <div className="add-member-avatar-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <h3>Add Member</h3>
          <button type="button" className="add-member-close" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>

        <form onSubmit={handleAddMember} className="add-member-form">
          {error && <div className="add-member-error">{error}</div>}
          {success && <div className="add-member-success">{success}</div>}

          <div className="form-group">
            <label htmlFor="member-username">Username</label>
            <div className="input-wrapper">
              <input
                id="member-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                disabled={!!loading || !!success}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="member-email">Email Address</label>
            <div className="input-wrapper">
              <input
                id="member-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                disabled={!!loading || !!success}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="member-password">Password</label>
            <div className="input-wrapper">
              <input
                id="member-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (min 6 chars)"
                disabled={!!loading || !!success}
              />
              <button
                type="button"
                className="password-visibility-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={!!loading || !!success}
              >
                <EyeIcon isVisible={showPassword} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Member Role</label>
            <div className="role-cards-container">
              <div
                className={`role-card ${role === 'viewer' ? 'active' : ''}`}
                onClick={() => !(!!loading || !!success) && setRole('viewer')}
              >
                <div className="role-card-title">User</div>
                <div className="role-card-desc">Standard member with board view/edit privileges.</div>
              </div>
              <div
                className={`role-card ${role === 'admin' ? 'active' : ''}`}
                onClick={() => !(!!loading || !!success) && setRole('admin')}
              >
                <div className="role-card-title">Admin</div>
                <div className="role-card-desc">Full system access, user approvals & management.</div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-add-member" disabled={!!loading || !!success}>
              {loading ? 'Adding Member...' : 'Save Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default memo(AddMember);
