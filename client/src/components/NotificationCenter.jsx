import React from 'react';
import '../styles/NotificationCenter.css';

function NotificationCenter({ notifications, onDismiss }) {
  if (!notifications?.length) {
    return null;
  }

  return (
    <div className="notification-center" aria-live="polite" aria-atomic="true">
      {notifications.map((notification) => (
        <div key={notification.id} className="notification-toast">
          <div className="notification-toast-copy">
            <strong>{notification.title}</strong>
            <p>{notification.message}</p>
          </div>
          <button
            type="button"
            className="notification-toast-close"
            onClick={() => onDismiss(notification.id)}
            aria-label="Dismiss notification"
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}

export default NotificationCenter;
