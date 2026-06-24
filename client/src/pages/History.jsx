import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/History.css';

const HISTORY_FILTER_OPTIONS = [
  { value: '1h', label: 'An hour ago' },
  { value: '12h', label: '12 hours ago' },
  { value: '7d', label: 'Week ago' },
  { value: '15d', label: '15 days ago' },
];

function History({ user, onLogout }) {
  const navigate = useNavigate();
  const [historyEvents, setHistoryEvents] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const isAdmin = user?.role === 'admin';

  const getHistoryThresholdMs = (filter) => {
    switch (filter) {
      case '1h':
        return 60 * 60 * 1000;
      case '12h':
        return 12 * 60 * 60 * 1000;
      case '15d':
        return 15 * 24 * 60 * 60 * 1000;
      case '7d':
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  };

  const fetchHistoryCards = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const boardListResponse = await axios.get('/api/boards', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const boards = boardListResponse.data || [];
      const boardDetailResults = await Promise.allSettled(
        boards.map((board) =>
          axios.get(`/api/boards/${board.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );

      const cards = boardDetailResults
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => {
          const boardData = result.value.data;
          return (boardData.lists || []).flatMap((list) =>
            (list.cards || []).map((card) => ({
              id: card.id,
              title: card.title,
              boardId: boardData.id,
              boardTitle: boardData.title,
              listTitle: list.title,
            }))
          );
        });

      const cardDetailResults = await Promise.allSettled(
        cards.map((card) =>
          axios.get(`/api/cards/${card.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((response) => ({ card, details: response.data }))
        )
      );

      const historyItems = cardDetailResults
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => {
          const { card, details } = result.value;
          const activityItems = Array.isArray(details.activity) ? details.activity : [];
          return activityItems.map((activity) => ({
            id: `${card.id}-${activity.id}`,
            cardId: card.id,
            cardTitle: card.title,
            boardTitle: card.boardTitle,
            listTitle: card.listTitle,
            actionType: activity.action_type,
            message: activity.message || activity.action_type || 'Activity recorded',
            createdAt: activity.created_at || Date.now(),
          }));
        });

      setHistoryEvents(historyItems);
      setError('');
    } catch (err) {
      setError('Failed to load history cards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryCards();
  }, []);

  const filteredEvents = useMemo(() => {
    const threshold = Date.now() - getHistoryThresholdMs(historyFilter);

    return historyEvents
      .filter((event) => {
        const createdAt = new Date(event.createdAt || 0).getTime();
        return Number.isFinite(createdAt) && createdAt >= threshold;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [historyEvents, historyFilter]);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  if (!isAdmin) {
    return (
      <div className="history-page">
        <header className="history-header">
          <div className="history-header-content">
            <button className="back-btn" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
            <div className="history-title-wrap">
              <h1>History</h1>
            </div>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </header>
        <main className="history-main">
          <div className="error-message">Only admins can access history manager.</div>
        </main>
      </div>
    );
  }

  return (
    <div className="history-page">
      <header className="history-header">
        <div className="history-header-content">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
          <div className="history-title-wrap">
            <h1>History Manager</h1>
          </div>
          <div className="history-user-actions">
            <span>{user?.username}</span>
            <div className="history-profile-area">
              <button
                type="button"
                className="history-profile-avatar-btn"
                onClick={() => setShowProfileMenu((prev) => !prev)}
              >
                {user?.username ? user.username.slice(0, 2).toUpperCase() : 'NA'}
              </button>
              {showProfileMenu && (
                <div className="history-profile-dropdown">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleLogout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="history-main">
        {error && <div className="error-message">{error}</div>}

        <div className="history-toolbar">
          <label htmlFor="history-filter">Filter</label>
          <select
            id="history-filter"
            className="history-filter-select"
            value={historyFilter}
            onChange={(e) => setHistoryFilter(e.target.value)}
          >
            {HISTORY_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading history...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="history-empty">No history events found for this time range.</div>
        ) : (
          <div className="history-list">
            {filteredEvents.map((event) => (
              <div key={event.id} className="history-item">
                <div className="history-item-copy">
                  <strong>{event.cardTitle}</strong>
                  <span>{event.boardTitle} • {event.listTitle}</span>
                  <small>{new Date(event.createdAt || Date.now()).toLocaleString()}</small>
                  <p>{event.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default History;
