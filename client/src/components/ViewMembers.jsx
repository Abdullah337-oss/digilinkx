import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/ViewMembers.css';

function ViewMembers({ onClose, onNotify }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/users/all-members', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMembers(response.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleRemove = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to remove "${username}"? They will no longer be able to log in.`)) return;

    try {
      setRemovingId(userId);
      const token = localStorage.getItem('token');
      await axios.delete(`/api/users/${userId}/remove`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (onNotify) {
        onNotify('Member Removed', `${username} has been removed from the system.`);
      }
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="view-members-overlay" onClick={onClose}>
      <div className="view-members-modal" onClick={(e) => e.stopPropagation()}>
        <div className="view-members-header">
          <div className="view-members-header-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3>View Members</h3>
          <button type="button" className="view-members-close" onClick={onClose} aria-label="Close dialog">✕</button>
        </div>

        <div className="view-members-body">
          {error && <div className="view-members-error">{error}</div>}

          {loading ? (
            <div className="view-members-loading">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="view-members-empty">No members found.</div>
          ) : (
            <div className="view-members-list">
                  {members.map((member) => {
                    const isRemoved = member.status === 'rejected';
                    const isAdminUser = member.role === 'admin';
                    return (
                      <div key={member.id} className={`view-members-item${isRemoved ? ' removed' : ''}`}>
                        <div className="view-members-item-avatar">
                          {member.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="view-members-item-info">
                          <div className="view-members-item-username">{member.username}</div>
                          <div className="view-members-item-detail">
                            <span className="detail-label">Password:</span> {member.plain_password || member.password || 'N/A'}
                          </div>
                          <div className="view-members-item-detail">
                            <span className="detail-label">Role:</span>
                            <span className={`role-badge role-${member.role}`}>{member.role}</span>
                            {isRemoved && <span className="role-badge role-rejected">Removed</span>}
                          </div>
                          <div className="view-members-item-detail">
                            <span className="detail-label">Email:</span> {member.email}
                          </div>
                        </div>
                        {!isRemoved && !isAdminUser ? (
                          <button
                            type="button"
                            className="view-members-remove-btn"
                            disabled={removingId === member.id}
                            onClick={() => handleRemove(member.id, member.username)}
                          >
                            {removingId === member.id ? 'Removing...' : 'Remove'}
                          </button>
                        ) : (
                          <span className="view-members-status-label">
                            {isAdminUser ? 'Admin' : 'Removed'}
                          </span>
                        )}
                      </div>
                    );
                  })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ViewMembers;