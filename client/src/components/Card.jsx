import React from 'react';
import '../styles/Card.css';

function Card({ card, onClick, onDelete, canDelete, showSelectControl = false, isSelected = false, onToggleSelect }) {
  const cardDueDate = card.dates?.due_date || card.due_date;
  const cardDueTime = card.dates?.due_time || card.due_time;
  const backendBaseUrl =
    (window.appConfig?.apiBaseUrl) ||
    process.env.REACT_APP_API_BASE_URL ||
    window.location.origin;
  const assignedMembers = Array.isArray(card.memberUsernames) && card.memberUsernames.length > 0
    ? card.memberUsernames
        .filter(Boolean)
        .map((name) => ({
          id: name,
          displayName: name,
        }))
    : Array.isArray(card.members)
      ? card.members
          .map((member) => ({
            id: member.id || member.email || member.username,
            displayName: member.username || member.email,
          }))
          .filter((member) => member.displayName)
      : [];

  const getInitials = (displayName) => {
    const normalizedName = (displayName || '').trim();

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

  const isImageAttachmentCandidate = (candidate) => {
    const normalized = String(candidate || '').trim().replace(/[#?].*$/, '');
    return /\.(avif|bmp|gif|jpe?g|png|webp|svg)$/i.test(normalized);
  };

  const getAttachmentUrl = (attachment) => {
    if (!attachment) return '';
    if (attachment.file_url) {
      return attachment.file_url.startsWith('http')
        ? attachment.file_url
        : `${backendBaseUrl}${attachment.file_url}`;
    }
    if (attachment.url) {
      return attachment.url;
    }
    if (attachment.file_path) {
      return `${backendBaseUrl}/uploads/${attachment.file_path}`;
    }
    return '';
  };

  const imageAttachment = Array.isArray(card.attachments)
    ? [...card.attachments]
        .sort((a, b) => Number(Boolean(b.is_cover)) - Number(Boolean(a.is_cover)))
        .find((attachment) => {
          const candidate = attachment?.file_url || attachment?.url || attachment?.file_name || attachment?.file_path || '';
          return isImageAttachmentCandidate(candidate);
        })
    : null;

  const imageSrc = getAttachmentUrl(imageAttachment) || null;

  const formattedDueDate = cardDueDate
    ? new Date(cardDueDate).toLocaleDateString()
    : '';
  const formattedDueTime = cardDueTime
    ? new Date(`1970-01-01T${cardDueTime}`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  return (
    <div className={`card${isSelected ? ' card-selected' : ''}`} onClick={onClick}>
      {imageSrc && (
        <div className="card-cover-wrapper">
          <img
            src={imageSrc}
            alt={imageAttachment.file_name || `${card.title} attachment`}
            className="card-cover-image"
            loading="lazy"
          />
        </div>
      )}

      <div className="card-header">
        <h4>{card.title}</h4>
        {canDelete && (
          <button
            className="card-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete card"
          >
            x
          </button>
        )}
      </div>

      {card.description && (
        <p className="card-description">{card.description}</p>
      )}

      <div className="card-footer">
        {card.labels?.length > 0 && (
          <div className="card-labels">
            {card.labels.map((label, index) => (
              <span key={label.id || `${label.name}-${index}`} className="label" style={{ backgroundColor: label.color }}>
                {label.name}
              </span>
            ))}
          </div>
        )}

        {(cardDueDate || cardDueTime || card.attachments?.length > 0 || card.checklists?.length > 0 || assignedMembers.length > 0) && (
          <div
            className="card-bottom-row"
            title={assignedMembers.length > 0 ? `Assigned to: ${assignedMembers.map((member) => member.displayName).join(', ')}` : undefined}
          >
            <div className="card-bottom-copy">
              <div className="card-meta">
                {(cardDueDate || cardDueTime) && (
                  <span className="card-meta-item" title="Due date">
                    Due: {[formattedDueDate, formattedDueTime].filter(Boolean).join(', ')}
                  </span>
                )}
                {card.attachments?.length > 0 && (
                  <span className="card-meta-item" title="Attachments">
                    Attachments: {card.attachments.length}
                  </span>
                )}
              </div>
            </div>

            {(assignedMembers.length > 0 || card.checklists?.length > 0 || showSelectControl) && (
              <div className="card-avatar-and-checklist">
                {card.checklists?.length > 0 && (
                  <div className="card-checklist-above-avatar">
                    <span className="card-meta-item" title="Checklist items">
                      Done: {card.checklists[0].items_completed || 0}/{card.checklists[0].items_total || 0}
                    </span>
                  </div>
                )}
                {showSelectControl && (
                  <div className="card-select-control" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="card-select-checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect && onToggleSelect()}
                      aria-label={`Select card ${card.title}`}
                    />
                  </div>
                )}
                {assignedMembers.length > 0 && (
                  <div className="card-assigned-avatar-stack" aria-hidden="true">
                    {assignedMembers.map((member) => (
                      <span key={member.id} className="card-assigned-avatar">
                        {getInitials(member.displayName)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Card;
