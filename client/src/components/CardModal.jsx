import React, { useRef, useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import '../styles/CardModal.css';

function CardModal({
  card,
  user,
  boardMembers = [],
  onClose,
  onCardUpdate,
  onCardDelete,
  canDelete,
  startInTitleEdit = false,
  onNotify,
}) {
  const [cardData, setCardData] = useState({
    ...card,
    attachments: card.attachments || [],
    checklists: card.checklists || [],
    comments: card.comments || [],
    activity: card.activity || []
  });
  const [description, setDescription] = useState(card.description || '');
  const [newLabel, setNewLabel] = useState('');
  const [labelColor, setLabelColor] = useState('#808080');
  const [selectedBoardMemberId, setSelectedBoardMemberId] = useState('');
  const [draftLabels, setDraftLabels] = useState(card.labels || []);
  const [draftMembers, setDraftMembers] = useState(card.members || []);
  const [dueDate, setDueDate] = useState(card.dates?.due_date || '');
  const [dueTime, setDueTime] = useState(card.dates?.due_time || '');
  const [dateTimePasteValue, setDateTimePasteValue] = useState('');
  const [cardTitle, setCardTitle] = useState(card.title || '');
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [openAttachmentMenuId, setOpenAttachmentMenuId] = useState(null);
  const [labelSearch, setLabelSearch] = useState('');
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [checklistItemDrafts, setChecklistItemDrafts] = useState({});
  const [mentionContext, setMentionContext] = useState({
    open: false,
    query: '',
    start: -1,
    end: -1,
    highlightedIndex: 0,
  });
  const pasteTargetRef = useRef(null);
  const fileInputRef = useRef(null);
  const commentTextareaRef = useRef(null);
  const descriptionSectionRef = useRef(null);
  const labelsSectionRef = useRef(null);
  const datesSectionRef = useRef(null);
  const membersSectionRef = useRef(null);
  const checklistSectionRef = useRef(null);

  const token = localStorage.getItem('token');
  const backendBaseUrl =
    (window.appConfig?.apiBaseUrl) ||
    process.env.REACT_APP_API_BASE_URL ||
    window.location.origin;

  const getAttachmentHref = (attachment) => {
    if (!attachment) return '';

    if ((attachment.attachment_type || 'file') === 'link') {
      return attachment.url || '';
    }

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

  const isImageAttachmentCandidate = (candidate) => {
    const normalized = String(candidate || '').trim().replace(/[#?].*$/, '');
    return /\.(avif|bmp|gif|jpe?g|png|webp|svg)$/i.test(normalized);
  };

  const isImageAttachment = (attachment) => {
    const candidate = attachment?.file_url || attachment?.url || attachment?.file_name || attachment?.file_path || '';
    return isImageAttachmentCandidate(candidate);
  };

  const getAttachmentThumbnail = (attachment) => (
    (attachment?.attachment_type || 'file') === 'file' && isImageAttachment(attachment)
      ? getAttachmentHref(attachment)
      : ''
  );

  const getShareUrl = (sharePath) => (
    sharePath?.startsWith('http')
      ? sharePath
      : `${backendBaseUrl}${sharePath}`
  );

  const getDirectAttachmentShareUrl = (attachment) => {
    if (!attachment) return '';

    if ((attachment.attachment_type || 'file') === 'link') {
      return attachment.url || '';
    }

    return getAttachmentHref(attachment);
  };

  const formatTimestamp = (value) => {
    if (!value) return '';

    return new Date(value).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const toggleDropdown = (dropdownName) => {
    setOpenDropdown((current) => (current === dropdownName ? null : dropdownName));
  };

  const filteredLabels = draftLabels.filter((label) =>
    (label.name || '').toLowerCase().includes(labelSearch.trim().toLowerCase())
  );

  const mentionableMembers = useMemo(() => {
    const merged = [...(boardMembers || []), ...(draftMembers || []), ...(cardData.members || [])];
    if (user) {
      merged.push(user);
    }

    const uniqueMembers = [];
    const seen = new Set();

    merged.forEach((member) => {
      if (!member) return;
      const idKey = member.id != null ? `id:${member.id}` : null;
      const emailKey = member.email ? `email:${String(member.email).toLowerCase()}` : null;
      const usernameKey = member.username ? `username:${String(member.username).toLowerCase()}` : null;
      const dedupeKey = idKey || emailKey || usernameKey;
      if (!dedupeKey || seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      uniqueMembers.push(member);
    });

    return uniqueMembers;
  }, [boardMembers, draftMembers, cardData.members, user]);

  const mentionSuggestions = useMemo(() => {
    if (!mentionContext.open) return [];

    const query = mentionContext.query.trim().toLowerCase();
    return mentionableMembers
      .map((member) => {
        const username = (member.username || '').trim();
        const email = (member.email || '').trim();
        const role = (member.role || '').trim();
        const display = username || email || `User ${member.id}`;
        const mentionKey = (username || email.split('@')[0] || `user${member.id || ''}`)
          .replace(/\s+/g, '')
          .replace(/[^\w.-]/g, '');
        const searchable = `${username} ${email} ${role}`.toLowerCase();

        return {
          ...member,
          display,
          email,
          role,
          mentionKey: mentionKey || `user${member.id || ''}`,
          searchable,
        };
      })
      .filter((member) => !query || member.searchable.includes(query))
      .slice(0, 10);
  }, [mentionContext.open, mentionContext.query, mentionableMembers]);

  const allAvailableMembers = useMemo(() => {
    const merged = [...(boardMembers || []), ...(cardData.members || [])];
    const unique = new Map();
    merged.forEach((member) => {
      if (!member) return;
      const idKey = member.id != null ? String(member.id) : `${member.username || ''}::${member.email || ''}`;
      if (!unique.has(idKey)) {
        unique.set(idKey, member);
      }
    });
    return Array.from(unique.values());
  }, [boardMembers, cardData.members]);

  const syncMentionContext = (text, cursorPosition) => {
    const safeCursorPosition = typeof cursorPosition === 'number' ? cursorPosition : text.length;
    const beforeCursor = text.slice(0, safeCursorPosition);
    const atIndex = beforeCursor.lastIndexOf('@');

    if (atIndex < 0) {
      setMentionContext((prev) => (prev.open ? { open: false, query: '', start: -1, end: -1, highlightedIndex: 0 } : prev));
      return;
    }

    const previousChar = atIndex > 0 ? beforeCursor[atIndex - 1] : '';
    if (previousChar && /[A-Za-z0-9._%+-]/.test(previousChar)) {
      setMentionContext((prev) => (prev.open ? { open: false, query: '', start: -1, end: -1, highlightedIndex: 0 } : prev));
      return;
    }

    const candidate = beforeCursor.slice(atIndex, safeCursorPosition);
    if (!/^@[^\s@]*$/.test(candidate)) {
      setMentionContext((prev) => (prev.open ? { open: false, query: '', start: -1, end: -1, highlightedIndex: 0 } : prev));
      return;
    }

    const query = candidate.slice(1);
    setMentionContext((prev) => ({
      open: true,
      query,
      start: atIndex,
      end: safeCursorPosition,
      highlightedIndex: prev.query === query ? prev.highlightedIndex : 0,
    }));
  };

  const insertMention = (selectedMember) => {
    if (!selectedMember || mentionContext.start < 0 || mentionContext.end < 0) return;

    const mentionText = `@${selectedMember.mentionKey} `;
    const updatedComment =
      newComment.slice(0, mentionContext.start) +
      mentionText +
      newComment.slice(mentionContext.end);

    setNewComment(updatedComment);
    setMentionContext({ open: false, query: '', start: -1, end: -1, highlightedIndex: 0 });
    setError('');

    window.requestAnimationFrame(() => {
      if (!commentTextareaRef.current) return;
      const nextCaret = mentionContext.start + mentionText.length;
      commentTextareaRef.current.focus();
      commentTextareaRef.current.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleCommentInputChange = (e) => {
    const nextValue = e.target.value;
    const cursorPosition = e.target.selectionStart;
    setNewComment(nextValue);
    syncMentionContext(nextValue, cursorPosition);
  };

  const handleCommentInputSelect = (e) => {
    syncMentionContext(e.target.value, e.target.selectionStart);
  };

  const handleCommentKeyDown = (e) => {
    if (!mentionContext.open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!mentionSuggestions.length) return;
      setMentionContext((prev) => ({
        ...prev,
        highlightedIndex: (prev.highlightedIndex + 1) % mentionSuggestions.length,
      }));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!mentionSuggestions.length) return;
      setMentionContext((prev) => ({
        ...prev,
        highlightedIndex: (prev.highlightedIndex - 1 + mentionSuggestions.length) % mentionSuggestions.length,
      }));
      return;
    }

    if ((e.key === 'Enter' || e.key === 'Tab') && mentionSuggestions.length) {
      e.preventDefault();
      const selected = mentionSuggestions[mentionContext.highlightedIndex] || mentionSuggestions[0];
      insertMention(selected);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setMentionContext({ open: false, query: '', start: -1, end: -1, highlightedIndex: 0 });
    }
  };

  const formatDateInputValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeInputValue = (date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const normalizeDateInputValue = (value) => {
    if (!value) return '';
    if (typeof value === 'string') {
      const isoDateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoDateMatch) return isoDateMatch[1];
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : formatDateInputValue(parsed);
  };

  const normalizeTimeInputValue = (value) => {
    if (!value) return '';
    const timeMatch = String(value).match(/^(\d{2}:\d{2})/);
    return timeMatch ? timeMatch[1] : '';
  };

  const normalizeHour = (hourValue, meridiem) => {
    let hour = Number(hourValue);
    if (Number.isNaN(hour)) return null;

    if (meridiem) {
      const lowerMeridiem = meridiem.toLowerCase();
      if (lowerMeridiem === 'pm' && hour < 12) hour += 12;
      if (lowerMeridiem === 'am' && hour === 12) hour = 0;
    }

    if (hour < 0 || hour > 23) return null;
    return hour;
  };

  const buildValidatedDate = (year, month, day, hour = 0, minute = 0) => {
    const parsedYear = Number(year);
    const parsedMonth = Number(month);
    const parsedDay = Number(day);
    const parsedHour = Number(hour);
    const parsedMinute = Number(minute);

    if (
      Number.isNaN(parsedYear) ||
      Number.isNaN(parsedMonth) ||
      Number.isNaN(parsedDay) ||
      Number.isNaN(parsedHour) ||
      Number.isNaN(parsedMinute)
    ) {
      return null;
    }

    if (
      parsedMonth < 1 ||
      parsedMonth > 12 ||
      parsedDay < 1 ||
      parsedDay > 31 ||
      parsedHour < 0 ||
      parsedHour > 23 ||
      parsedMinute < 0 ||
      parsedMinute > 59
    ) {
      return null;
    }

    const candidate = new Date(parsedYear, parsedMonth - 1, parsedDay, parsedHour, parsedMinute, 0, 0);
    if (
      candidate.getFullYear() !== parsedYear ||
      candidate.getMonth() !== parsedMonth - 1 ||
      candidate.getDate() !== parsedDay
    ) {
      return null;
    }

    return candidate;
  };

  const normalizeLooseYear = (value) => {
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) return null;
    if (String(value).length === 2) {
      return numberValue >= 70 ? 1900 + numberValue : 2000 + numberValue;
    }
    return numberValue;
  };

  const extractTimeFromText = (value) => {
    const source = (value || '').trim();
    if (!source) return { hasTime: false, hour: 0, minute: 0, textWithoutTime: source };

    const timeRegex = /(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?/gi;
    let bestMatch = null;
    let currentMatch = timeRegex.exec(source);

    while (currentMatch) {
      const rawHours = Number(currentMatch[1]);
      const rawMinutes = currentMatch[2] == null ? 0 : Number(currentMatch[2]);
      const hasColon = currentMatch[0].includes(':');
      const hasMeridiem = Boolean(currentMatch[3]);
      const isLikelyTime = hasMeridiem || hasColon;

      if (isLikelyTime && !Number.isNaN(rawHours) && !Number.isNaN(rawMinutes)) {
        const normalizedHour = normalizeHour(rawHours, currentMatch[3]);
        if (normalizedHour !== null && rawMinutes >= 0 && rawMinutes <= 59) {
          bestMatch = {
            index: currentMatch.index,
            value: currentMatch[0],
            hour: normalizedHour,
            minute: rawMinutes,
          };
        }
      }

      currentMatch = timeRegex.exec(source);
    }

    if (!bestMatch) {
      return { hasTime: false, hour: 0, minute: 0, textWithoutTime: source };
    }

    const textWithoutTime = `${source.slice(0, bestMatch.index)} ${source.slice(bestMatch.index + bestMatch.value.length)}`
      .replace(/\b(at|around|by)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      hasTime: true,
      hour: bestMatch.hour,
      minute: bestMatch.minute,
      textWithoutTime,
    };
  };

  const parseDateFromNumericTokens = (tokens, hour, minute) => {
    if (tokens.length < 3) return null;

    const firstThree = tokens.slice(0, 3);
    const [aRaw, bRaw, cRaw] = firstThree;
    const a = Number(aRaw);
    const b = Number(bRaw);
    const c = Number(cRaw);

    const candidates = [];

    const yearFromA = normalizeLooseYear(aRaw);
    const yearFromC = normalizeLooseYear(cRaw);

    if (String(aRaw).length === 4 || a > 31) {
      candidates.push([yearFromA, b, c]); // Y-M-D
      candidates.push([yearFromA, c, b]); // Y-D-M
    }

    if (String(cRaw).length === 4 || c > 31) {
      candidates.push([yearFromC, a, b]); // M-D-Y
      candidates.push([yearFromC, b, a]); // D-M-Y
    }

    if (c <= 31 && a <= 31 && b <= 12) {
      candidates.push([normalizeLooseYear(cRaw), b, a]); // D-M-YY style fallback
    }

    for (const [year, month, day] of candidates) {
      const valid = buildValidatedDate(year, month, day, hour, minute);
      if (valid) return valid;
    }

    return null;
  };

  const parseDateTimeFromLooseText = (value) => {
    const cleaned = (value || '')
      .trim()
      .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
      .replace(/[,]+/g, ' ')
      .replace(/\s+/g, ' ');
    if (!cleaned) return null;

    // Unix timestamp support (seconds or milliseconds)
    if (/^\d{10,13}$/.test(cleaned)) {
      const timestamp = cleaned.length === 13 ? Number(cleaned) : Number(cleaned) * 1000;
      const parsed = new Date(timestamp);
      if (!Number.isNaN(parsed.getTime())) {
        return { date: parsed, hasTime: true };
      }
    }

    const { hasTime, hour, minute, textWithoutTime } = extractTimeFromText(cleaned);
    const parseTarget = textWithoutTime || cleaned;

    // Native parser first for natural language strings like "April 8 2026"
    const nativeParsed = new Date(cleaned);
    if (!Number.isNaN(nativeParsed.getTime())) {
      if (hasTime) {
        nativeParsed.setHours(hour, minute, 0, 0);
      }
      return { date: nativeParsed, hasTime };
    }

    const nativeDateOnly = new Date(parseTarget);
    if (!Number.isNaN(nativeDateOnly.getTime())) {
      nativeDateOnly.setHours(hour, minute, 0, 0);
      return { date: nativeDateOnly, hasTime };
    }

    // Numeric fallback for loose separators like 8-4-26, 2026/4/8, 08.04.2026
    const numericTokens = (parseTarget.match(/\d{1,4}/g) || []).slice(0, 3);
    const numericDate = parseDateFromNumericTokens(numericTokens, hour, minute);
    if (numericDate) {
      return { date: numericDate, hasTime };
    }

    return null;
  };

  const parseDateTimeFromText = (value) => {
    const parsed = parseDateTimeFromLooseText(value);
    if (!parsed) return null;

    return {
      dueDateValue: formatDateInputValue(parsed.date),
      dueTimeValue: formatTimeInputValue(parsed.date),
      hasTime: parsed.hasTime,
    };
  };

  const applyPastedDateTime = (rawValue) => {
    const parsed = parseDateTimeFromText(rawValue);
    if (!parsed) {
      setError('Could not parse this value. Try adding a clearer date/time (for example with month name or AM/PM).');
      return;
    }

    setDueDate(parsed.dueDateValue);
    if (user?.role === 'admin') {
      setDueTime(parsed.hasTime ? parsed.dueTimeValue : '');
    }
    setError('');
  };

  const handlePasteDateTime = (e) => {
    const pastedText = e.clipboardData?.getData('text') || '';
    if (!pastedText.trim()) return;

    e.preventDefault();
    setDateTimePasteValue(pastedText);
    applyPastedDateTime(pastedText);
  };

  // Load full card details when modal opens
  useEffect(() => {
    const fetchCardDetails = async () => {
      try {
        console.log('Fetching card details for card ID:', card.id);
        const response = await axios.get(`/api/cards/${card.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Card details fetched:', response.data);
        console.log('Attachments from server:', response.data.attachments);
        console.log('Number of attachments:', response.data.attachments?.length || 0);
        setCardData({
          ...response.data,
          attachments: response.data.attachments || [],
          checklists: response.data.checklists || [],
          comments: response.data.comments || [],
          activity: response.data.activity || []
        });
        setDescription(response.data.description || '');
        setCardTitle(response.data.title || '');
        setDueDate(normalizeDateInputValue(response.data.dates?.due_date));
        setDueTime(normalizeTimeInputValue(response.data.dates?.due_time));
        setDraftLabels(response.data.labels || []);
        setDraftMembers(response.data.members || []);
      } catch (err) {
        console.error('Failed to load card details:', err);
        setError('Failed to load card details');
      }
    };

    if (card?.id && token) {
      fetchCardDetails();
    }
  }, [card?.id, token]);

  const refreshCardData = async () => {
    try {
      const response = await axios.get(`/api/cards/${card.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Card refreshed, attachments:', response.data.attachments);

      const refreshedCard = {
        ...response.data,
        attachments: response.data.attachments || [],
        checklists: response.data.checklists || [],
        comments: response.data.comments || [],
        activity: response.data.activity || []
      };

      setCardData(refreshedCard);
      setCardTitle(refreshedCard.title || '');
      setDescription(refreshedCard.description || '');
      setDueDate(normalizeDateInputValue(refreshedCard.dates?.due_date));
      setDueTime(normalizeTimeInputValue(refreshedCard.dates?.due_time));
      setDraftLabels(refreshedCard.labels || []);
      setDraftMembers(refreshedCard.members || []);
      onCardUpdate(refreshedCard);
    } catch (err) {
      console.error('Failed to refresh card:', err);
    }
  };

  const handleSaveCardChanges = async () => {
    const trimmedTitle = cardTitle.trim();
    const pendingLabelName = newLabel.trim();
    const pendingMemberId = Number(selectedBoardMemberId);

    if (!trimmedTitle) {
      setError('Card title is required');
      return;
    }

    const effectiveDraftLabels = pendingLabelName
      ? [
          ...draftLabels,
          {
            id: `temp-label-save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: pendingLabelName,
            color: labelColor,
          },
        ]
      : draftLabels;

    const pendingMember = allAvailableMembers.find((member) => Number(member.id) === pendingMemberId);
    const effectiveDraftMembers = pendingMember && !draftMembers.some((member) => Number(member.id) === pendingMemberId)
      ? [...draftMembers, pendingMember]
      : draftMembers;

    const currentTitle = cardData.title || '';
    const currentDescription = cardData.description || '';
    const currentDueDate = normalizeDateInputValue(cardData.dates?.due_date);
    const currentDueTime = normalizeTimeInputValue(cardData.dates?.due_time);
    const currentLabels = cardData.labels || [];
    const currentMembers = cardData.members || [];

    const currentLabelIds = new Set(currentLabels.map((label) => String(label.id)));
    const draftLabelIds = new Set(effectiveDraftLabels.map((label) => String(label.id)));
    const labelsToDelete = currentLabels.filter((label) => !draftLabelIds.has(String(label.id)));
    const labelsToCreate = effectiveDraftLabels.filter((label) => !currentLabelIds.has(String(label.id)));

    const currentMemberIds = new Set(currentMembers.map((member) => Number(member.id)));
    const draftMemberIds = new Set(effectiveDraftMembers.map((member) => Number(member.id)));
    const membersToRemove = currentMembers.filter((member) => !draftMemberIds.has(Number(member.id)));
    const membersToAdd = effectiveDraftMembers.filter((member) => !currentMemberIds.has(Number(member.id)));

    const hasCardUpdate = trimmedTitle !== currentTitle || description !== currentDescription;
    const hasDueDateUpdate = dueDate !== currentDueDate || dueTime !== currentDueTime;
    const hasLabelsUpdate = labelsToDelete.length > 0 || labelsToCreate.length > 0;
    const hasMembersUpdate = membersToRemove.length > 0 || membersToAdd.length > 0;

    if (!hasCardUpdate && !hasDueDateUpdate && !hasLabelsUpdate && !hasMembersUpdate) {
      setError('');
      return;
    }

    try {
      setLoading(true);

      if (hasCardUpdate) {
        await axios.put(
          `/api/cards/${card.id}`,
          { title: trimmedTitle, description },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      if (hasDueDateUpdate) {
        await axios.post(
          `/api/card-details/${card.id}/dates`,
          { due_date: dueDate || null, due_time: dueTime || null, start_date: null },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      if (labelsToDelete.length > 0) {
        await Promise.all(
          labelsToDelete.map((label) =>
            axios.delete(`/api/card-details/labels/${label.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
          )
        );
      }

      if (labelsToCreate.length > 0) {
        await Promise.all(
          labelsToCreate
            .filter((label) => (label.name || '').trim())
            .map((label) =>
              axios.post(
                `/api/card-details/${card.id}/labels`,
                { name: label.name.trim(), color: label.color || '#808080' },
                { headers: { Authorization: `Bearer ${token}` } }
              )
            )
        );
      }

      if (membersToRemove.length > 0) {
        await Promise.all(
          membersToRemove.map((member) =>
            axios.delete(`/api/card-details/${card.id}/members/${member.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
          )
        );
      }

      if (membersToAdd.length > 0) {
        await Promise.all(
          membersToAdd.map((member) =>
            axios.post(
              `/api/card-details/${card.id}/members`,
              { userId: Number(member.id) },
              { headers: { Authorization: `Bearer ${token}` } }
            )
          )
        );
      }

      await refreshCardData();
      setNewLabel('');
      setSelectedBoardMemberId('');
      setError('');
    } catch (err) {
      setError('Failed to save card changes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLabel = async (e) => {
    e.preventDefault();
    const trimmedLabel = newLabel.trim();
    if (!trimmedLabel) return;

    const tempId = `temp-label-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setDraftLabels((prev) => [
      ...prev,
      {
        id: tempId,
        name: trimmedLabel,
        color: labelColor,
      },
    ]);
    setNewLabel('');
    setError('');
  };

  const handleDeleteLabel = async (labelId) => {
    setDraftLabels((prev) => prev.filter((label) => String(label.id) !== String(labelId)));
    setError('');
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedBoardMemberId) return;

    const memberId = Number(selectedBoardMemberId);
    const memberToAdd = allAvailableMembers.find((member) => Number(member.id) === memberId);
    if (!memberToAdd) {
      setError('Selected member not found');
      return;
    }

    setDraftMembers((prev) => {
      if (prev.some((member) => Number(member.id) === memberId)) {
        return prev;
      }
      return [...prev, memberToAdd];
    });

    setSelectedBoardMemberId('');
    setError('');
  };

  const uploadAttachmentFiles = async (files) => {
    const validFiles = Array.from(files || []).filter(Boolean);

    if (!validFiles.length) return;

    try {
      setLoading(true);
      const formData = new FormData();
      validFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('cardId', card.id);

      await axios.post(
        `/api/card-details/${card.id}/attachments`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      await refreshCardData();
      onNotify?.(
        validFiles.length > 1 ? 'Attachments Uploaded' : 'Attachment Uploaded',
        `${validFiles.length} attachment${validFiles.length > 1 ? 's were' : ' was'} added to "${cardTitle || card.title || 'Untitled card'}".`
      );
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload attachment');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAttachment = async (e) => {
    const files = Array.from(e.target.files || []);
    await uploadAttachmentFiles(files);

    // Reset file input to allow uploading same file again
    e.target.value = '';
  };

  const getClipboardFile = (clipboardData) => {
    const items = Array.from(clipboardData?.items || []);
    const fileItem = items.find((item) => item.kind === 'file');
    return fileItem?.getAsFile() || null;
  };

  const handlePasteAttachment = async (e) => {
    const file = getClipboardFile(e.clipboardData);

    if (!file) {
      setError('Clipboard does not contain a file or image');
      return;
    }

    e.preventDefault();
    await uploadAttachmentFiles([file]);
  };

  const dragEventHasFiles = (event) => {
    const types = Array.from(event.dataTransfer?.types || []);
    return types.includes('Files');
  };

  const handleDragOverAttachment = (e) => {
    if (!dragEventHasFiles(e)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (!loading) {
      setIsDragOver(true);
    }
  };

  const handleDragLeaveAttachment = (e) => {
    if (!dragEventHasFiles(e)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) {
      return;
    }

    setIsDragOver(false);
  };

  const handleDropAttachment = async (e) => {
    if (!dragEventHasFiles(e)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (loading) {
      return;
    }

    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.length) {
      setError('Dropped item does not contain a file');
      return;
    }

    await uploadAttachmentFiles(files);
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;

    try {
      setLoading(true);
      await axios.delete(
        `/api/card-details/attachments/${attachmentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      refreshCardData();
      setError('');
    } catch (err) {
      setError('Failed to delete attachment');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    if ((attachment?.attachment_type || 'file') === 'link') {
      if (attachment.url) {
        window.open(attachment.url, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    try {
      const downloadUrl = `${backendBaseUrl}/api/card-details/attachments/${attachment.id}/download`;
      const response = await axios.get(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = attachment.file_name || 'attachment';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError('Failed to download attachment');
    }
  };

  const handleShareAttachment = async (attachment) => {
    let shareUrl = '';

    try {
      setLoading(true);
      const response = await axios.post(
        `/api/card-details/${card.id}/attachments/${attachment.id}/share`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      shareUrl = getShareUrl(response.data.shareUrl);

      await refreshCardData();
      setOpenAttachmentMenuId(null);
      setError('');
    } catch (err) {
      shareUrl = getDirectAttachmentShareUrl(attachment);
      if (!shareUrl) {
        setError(err.response?.data?.error || 'Failed to create share link');
        return;
      }

      setOpenAttachmentMenuId(null);
      setError('');
    } finally {
      setLoading(false);
    }

    if (!shareUrl) {
      setError('Failed to create share link');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        onNotify?.('Attachment link copied', 'Anyone with the link can view only this attachment.');
        return;
      }
    } catch (clipboardErr) {
      // Some browsers block clipboard writes outside secure contexts.
    }

    window.prompt('Copy this attachment share link:', shareUrl);
    onNotify?.('Attachment link ready', 'Anyone with the link can view only this attachment.');
  };

  const handleRenameAttachment = async (attachment) => {
    const nextName = window.prompt('Attachment name', attachment.file_name || '');
    const trimmedName = nextName?.trim();

    if (!trimmedName || trimmedName === attachment.file_name) {
      return;
    }

    try {
      setLoading(true);
      await axios.patch(
        `/api/card-details/attachments/${attachment.id}`,
        { fileName: trimmedName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshCardData();
      setOpenAttachmentMenuId(null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to edit attachment');
    } finally {
      setLoading(false);
    }
  };

  const handleMakeAttachmentCover = async (attachment) => {
    try {
      setLoading(true);
      await axios.post(
        `/api/card-details/attachments/${attachment.id}/cover`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshCardData();
      setOpenAttachmentMenuId(null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to make attachment the cover');
    } finally {
      setLoading(false);
    }
  };

  const handleAttachmentComment = (attachment) => {
    const prefix = `Comment on attachment "${attachment.file_name}": `;
    setNewComment((current) => (current.trim() ? current : prefix));
    setOpenAttachmentMenuId(null);
    window.requestAnimationFrame(() => {
      commentTextareaRef.current?.focus();
    });
  };

  const handleAddAttachmentLink = async (e) => {
    e.preventDefault();

    if (!linkUrl.trim()) {
      setError('Link URL is required');
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        `/api/card-details/${card.id}/attachments/link`,
        {
          title: linkTitle.trim(),
          url: linkUrl.trim(),
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setLinkTitle('');
      setLinkUrl('');
      await refreshCardData();
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add link');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    setDraftMembers((prev) => prev.filter((member) => Number(member.id) !== Number(memberId)));
    setError('');
  };

  const isMemberAlreadyAssigned = (memberId) =>
    draftMembers.some((selected) => Number(selected.id) === Number(memberId));

  const handleAddComment = async (e) => {
    e.preventDefault();

    if (!newComment.trim()) return;

    try {
      setLoading(true);
      await axios.post(
        `/api/card-details/${card.id}/comments`,
        { content: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewComment('');
      setMentionContext({ open: false, query: '', start: -1, end: -1, highlightedIndex: 0 });
      refreshCardData();
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add comment');
    } finally {
      setLoading(false);
    }
  };

  const handleAddChecklist = async (e) => {
    e.preventDefault();

    if (!newChecklistTitle.trim()) {
      setError('Checklist title is required');
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        `/api/card-details/${card.id}/checklists`,
        { title: newChecklistTitle.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewChecklistTitle('');
      await refreshCardData();
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add checklist');
    } finally {
      setLoading(false);
    }
  };

  const handleChecklistItemDraftChange = (checklistId, value) => {
    setChecklistItemDrafts((prev) => ({
      ...prev,
      [checklistId]: value,
    }));
  };

  const handleAddChecklistItem = async (e, checklistId) => {
    e.preventDefault();

    const text = checklistItemDrafts[checklistId]?.trim();
    if (!text) {
      setError('Checklist item text is required');
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        `/api/card-details/checklists/${checklistId}/items`,
        { text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setChecklistItemDrafts((prev) => ({
        ...prev,
        [checklistId]: '',
      }));
      await refreshCardData();
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add checklist item');
    } finally {
      setLoading(false);
    }
  };

  const renderLabelsDropdown = () => (
    <div className="card-dropdown-card">
      <div className="card-dropdown-header">
        <h4>Labels</h4>
        <button type="button" className="card-dropdown-close" onClick={() => setOpenDropdown(null)}>
          ×
        </button>
      </div>
      <input
        type="text"
        className="card-dropdown-search"
        placeholder="Search labels..."
        value={labelSearch}
        onChange={(e) => setLabelSearch(e.target.value)}
      />
      <div className="card-dropdown-subtitle">Labels</div>
      <div className="label-dropdown-list">
        {filteredLabels.length > 0 ? filteredLabels.map((label) => (
          <div key={label.id} className="label-dropdown-item">
            <button
              type="button"
              className="label-dropdown-swatch"
              style={{ backgroundColor: label.color }}
              onClick={() => {}}
              aria-label={label.name}
            >
              <span>{label.name}</span>
            </button>
            <button
              type="button"
              className="label-dropdown-edit"
              onClick={() => handleDeleteLabel(label.id)}
              title="Remove label"
            >
              ×
            </button>
          </div>
        )) : (
          <p className="section-note">No labels found</p>
        )}
      </div>
      <form onSubmit={handleAddLabel} className="card-dropdown-stack">
        <input
          type="text"
          className="attachment-link-input"
          placeholder="Create a new label"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          disabled={loading}
        />
        <input
          type="color"
          value={labelColor}
          onChange={(e) => setLabelColor(e.target.value)}
          disabled={loading}
          className="label-color-input"
        />
        <button type="submit" className="btn btn-small" disabled={loading}>
          Create a new label
        </button>
      </form>
    </div>
  );

  void renderLabelsDropdown;

  const renderDatesDropdown = () => (
    <div className="card-dropdown-card">
      <div className="card-dropdown-header">
        <h4>Dates</h4>
        <button type="button" className="card-dropdown-close" onClick={() => setOpenDropdown(null)}>
          ×
        </button>
      </div>
      <div className="card-dropdown-stack">
        <input
          type="text"
          value={dateTimePasteValue}
          onChange={(e) => setDateTimePasteValue(e.target.value)}
          onPaste={handlePasteDateTime}
          onBlur={(e) => {
            if (e.target.value.trim()) {
              applyPastedDateTime(e.target.value);
            } else {
              setError('');
            }
          }}
          className="date-input"
          placeholder="Paste date/time in any format"
        />
        <p className="date-input-hint">Any common date/time text is accepted, or use the picker icons below.</p>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="date-input"
        />
        {user?.role === 'admin' && (
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            className="date-input"
          />
        )}
        <button type="button" className="btn btn-small" onClick={handleSaveCardChanges} disabled={loading}>
          Save Dates
        </button>
      </div>
    </div>
  );

  const renderChecklistDropdown = () => (
    <div className="card-dropdown-card">
      <div className="card-dropdown-header">
        <h4>Checklist</h4>
        <button type="button" className="card-dropdown-close" onClick={() => setOpenDropdown(null)}>
          ×
        </button>
      </div>
      <form onSubmit={handleAddChecklist} className="card-dropdown-stack">
        <input
          type="text"
          className="attachment-link-input"
          placeholder="Add checklist title"
          value={newChecklistTitle}
          onChange={(e) => setNewChecklistTitle(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn btn-small" disabled={loading || !newChecklistTitle.trim()}>
          Add Checklist
        </button>
      </form>
      {cardData.checklists?.length > 0 ? (
        <div className="card-dropdown-stack">
          {cardData.checklists.map((checklist) => (
            <div key={checklist.id} className="checklist-item">
              <strong>{checklist.title}</strong>
              <p>Progress: {checklist.items_completed || 0}/{checklist.items_total || 0}</p>
              {checklist.items?.length > 0 ? (
                <div className="checklist-dropdown-items">
                  {checklist.items.map((item) => (
                    <label key={item.id} className="checklist-dropdown-item">
                      <input type="checkbox" checked={Boolean(item.completed)} readOnly />
                      <span>{item.text}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p>No checklist items yet</p>
              )}
              <form className="card-dropdown-stack checklist-item-form" onSubmit={(e) => handleAddChecklistItem(e, checklist.id)}>
                <input
                  type="text"
                  className="attachment-link-input"
                  placeholder="Add checklist item"
                  value={checklistItemDrafts[checklist.id] || ''}
                  onChange={(e) => handleChecklistItemDraftChange(checklist.id, e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="btn btn-small"
                  disabled={loading || !(checklistItemDrafts[checklist.id] || '').trim()}
                >
                  Add Item
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="section-note">No checklist added to this card yet.</p>
      )}
    </div>
  );

  const renderMembersDropdown = () => (
    <div className="card-dropdown-card">
      <div className="card-dropdown-header">
        <h4>Members</h4>
        <button type="button" className="card-dropdown-close" onClick={() => setOpenDropdown(null)}>
          ×
        </button>
      </div>
      <div className="members-list">
        {draftMembers.map((member) => (
          <div key={member.id} className="member-tag">
            {member.username || member.email}
            <button
              className="member-remove"
              onClick={() => handleRemoveMember(member.id)}
              title="Remove member"
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={handleAddMember} className="card-dropdown-stack">
        <select
          value={selectedBoardMemberId}
          onChange={(e) => setSelectedBoardMemberId(e.target.value)}
          disabled={loading}
          className="card-member-select"
        >
            <option value="">Select member</option>
            {allAvailableMembers.map((member) => {
              const alreadyAssigned = isMemberAlreadyAssigned(member.id);

              return (
                <option key={member.id} value={member.id} disabled={alreadyAssigned}>
                  {member.username || member.email} ({member.email || 'no email'}){alreadyAssigned ? ' - already added' : ''}
                </option>
              );
            })}
          </select>
          <button type="submit" className="btn btn-small" disabled={loading}>
            Add Member
          </button>
        </form>
    </div>
  );

  const renderAttachmentDropdown = () => (
    <div className="card-dropdown-card">
      <div className="card-dropdown-header">
        <h4>Attach</h4>
        <button type="button" className="card-dropdown-close" onClick={() => setOpenDropdown(null)}>
          ×
        </button>
      </div>
      <div className="card-dropdown-stack">
        <button 
          type="button" 
          className="btn btn-small" 
          onClick={() => {
            fileInputRef.current?.click();
            setOpenDropdown(null);
          }} 
          disabled={loading}
        >
          Select from device
        </button>
        <div className="card-dropdown-divider" style={{ margin: '12px 0' }} />
        <div className="card-dropdown-subtitle">Attach a link</div>
        <form onSubmit={(e) => {
          handleAddAttachmentLink(e);
          setOpenDropdown(null);
        }} className="card-dropdown-stack">
          <input
            type="text"
            className="attachment-link-input"
            placeholder="Paste any link here..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            disabled={loading}
          />
          <input
            type="text"
            className="attachment-link-input"
            placeholder="Link title (optional)"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn btn-small" disabled={loading || !linkUrl.trim()}>
            Attach
          </button>
        </form>
      </div>
    </div>
  );

  const renderLabelsDropdownPopover = () => (
    <div className="card-dropdown-card labels-dropdown-card">
      <div className="card-dropdown-header card-dropdown-header-centered">
        <span className="card-dropdown-header-spacer" aria-hidden="true" />
        <h4>Labels</h4>
        <button type="button" className="card-dropdown-close" onClick={() => setOpenDropdown(null)}>
          x
        </button>
      </div>
      <input
        type="text"
        className="card-dropdown-search"
        placeholder="Search labels..."
        value={labelSearch}
        onChange={(e) => setLabelSearch(e.target.value)}
      />
      <div className="card-dropdown-subtitle">Labels</div>
      <div className="label-dropdown-list">
        {filteredLabels.length > 0 ? (
          filteredLabels.map((label) => {
            const isAttached = draftLabels.some((draftLabel) => String(draftLabel.id) === String(label.id));

            return (
              <div key={label.id} className="label-dropdown-item">
                <button
                  type="button"
                  className={`label-dropdown-check${isAttached ? ' checked' : ''}`}
                  onClick={() => {}}
                  aria-label={label.name}
                >
                  {isAttached ? '✓' : ''}
                </button>
                <div className="label-dropdown-swatch" style={{ backgroundColor: label.color }}>
                  <span>{label.name}</span>
                </div>
                <button
                  type="button"
                  className="label-dropdown-edit"
                  onClick={() => handleDeleteLabel(label.id)}
                  title="Remove label"
                >
                  ✎
                </button>
              </div>
            );
          })
        ) : (
          <p className="section-note">No labels found</p>
        )}
      </div>
      <form onSubmit={handleAddLabel} className="card-dropdown-stack">
        <input
          type="text"
          className="attachment-link-input"
          placeholder="Create a new label"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          disabled={loading}
        />
        <input
          type="color"
          value={labelColor}
          onChange={(e) => setLabelColor(e.target.value)}
          disabled={loading}
          className="label-color-input"
        />
        <button type="submit" className="btn btn-small card-dropdown-footer-btn" disabled={loading}>
          Create a new label
        </button>
      </form>
      <div className="card-dropdown-divider" />
      <button type="button" className="btn btn-small card-dropdown-footer-btn card-dropdown-secondary-btn">
        Enable colorblind friendly mode
      </button>
    </div>
  );

  return (
    <div className="modal-overlay">
      <div
        className={`card-modal${isDragOver ? ' card-file-drag-over' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onDragOver={handleDragOverAttachment}
        onDragEnter={handleDragOverAttachment}
        onDragLeave={handleDragLeaveAttachment}
        onDrop={handleDropAttachment}
      >
        <button className="modal-close-btn" onClick={onClose}>✕</button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleUploadAttachment} 
          style={{ display: 'none' }} 
          multiple 
        />

        <div className="modal-header card-modal-top">
          <div className="card-title-row">
            <span className="card-title-ring" aria-hidden="true" />
            <input
              className="card-title-input"
              type="text"
              value={cardTitle}
              onChange={(e) => setCardTitle(e.target.value)}
              maxLength={200}
              autoFocus={Boolean(startInTitleEdit)}
              placeholder="Card title"
            />
          </div>
          <div className="card-quick-actions">
            <button type="button" className={`card-action-pill${openDropdown === 'labels' ? ' active' : ''}`} onClick={() => toggleDropdown('labels')}>Labels</button>
            <button type="button" className={`card-action-pill${openDropdown === 'dates' ? ' active' : ''}`} onClick={() => toggleDropdown('dates')}>Dates</button>
            <button type="button" className={`card-action-pill${openDropdown === 'checklist' ? ' active' : ''}`} onClick={() => toggleDropdown('checklist')}>Checklist</button>
            <button type="button" className={`card-action-pill${openDropdown === 'members' ? ' active' : ''}`} onClick={() => toggleDropdown('members')}>Members</button>
            <button type="button" className={`card-action-pill${openDropdown === 'attachment' ? ' active' : ''}`} onClick={() => toggleDropdown('attachment')} disabled={loading}>Attachment</button>
          </div>
          {openDropdown && (
            <div className="card-dropdown-shell">
              {openDropdown === 'labels' && renderLabelsDropdownPopover()}
              {openDropdown === 'dates' && renderDatesDropdown()}
              {openDropdown === 'checklist' && renderChecklistDropdown()}
              {openDropdown === 'members' && renderMembersDropdown()}
              {openDropdown === 'attachment' && renderAttachmentDropdown()}
            </div>
          )}
          <div className="modal-header-actions">
            <button
              className="btn btn-save-card"
              onClick={handleSaveCardChanges}
              disabled={loading}
            >
              Save Card
            </button>
            {canDelete && (
              <button
                className="btn btn-delete-card"
                onClick={() => {
                  onCardDelete();
                  onClose();
                }}
              >
                Delete Card
              </button>
            )}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="modal-body card-modal-body">
          <div className="modal-content modal-content-main card-modal-content">
            <section ref={descriptionSectionRef} className="modal-section modal-section-hero">
              <h3>Description</h3>
              <textarea
                className="modal-textarea modal-textarea-hero"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a more detailed description..."
              />
            </section>

            <section ref={labelsSectionRef} className="modal-section modal-panel inline-control-panel">
              <h3>Labels</h3>
              <div className="labels-list">
                {draftLabels?.map(label => (
                  <span
                    key={label.id}
                    className="label"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                    <button
                      className="label-remove"
                      onClick={() => handleDeleteLabel(label.id)}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <form onSubmit={handleAddLabel} className="add-label-form">
                <input
                  type="text"
                  placeholder="Label name"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  disabled={loading}
                />
                <input
                  type="color"
                  value={labelColor}
                  onChange={(e) => setLabelColor(e.target.value)}
                  disabled={loading}
                />
                <button type="submit" className="btn btn-small" disabled={loading}>
                  Add Label
                </button>
              </form>
            </section>

            <section ref={membersSectionRef} className="modal-section modal-panel inline-control-panel">
              <h3>Members</h3>
              <div className="members-list">
                {draftMembers.map(member => (
                  <div key={member.id} className="member-tag">
                    {member.username || member.email}
                    <button
                      className="member-remove"
                      onClick={() => handleRemoveMember(member.id)}
                      title="Remove member"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddMember} className="add-member-form">
                <select
                  value={selectedBoardMemberId}
                  onChange={(e) => setSelectedBoardMemberId(e.target.value)}
                  disabled={loading}
                  className="card-member-select"
                >
                    <option value="">Select member</option>
                    {allAvailableMembers.map((member) => {
                      const alreadyAssigned = isMemberAlreadyAssigned(member.id);

                      return (
                        <option key={member.id} value={member.id} disabled={alreadyAssigned}>
                          {member.username || member.email} ({member.email || 'no email'}){alreadyAssigned ? ' - already added' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <button type="submit" className="btn btn-small" disabled={loading}>
                    Add Member
                  </button>
                </form>
            </section>

            <section ref={datesSectionRef} className="modal-section modal-panel inline-control-panel">
              <h3>Due Date</h3>
              <div className="date-time-inputs">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="date-input"
                />
                {user?.role === 'admin' && (
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="date-input"
                  />
                )}
              </div>
            </section>

            <section ref={checklistSectionRef} className="modal-section modal-panel inline-control-panel">
              <h3>Checklist</h3>
              <p className="section-note">Checklist styling can go here in the next change.</p>
            </section>

            <section className="modal-section attachments-section">
              <h3>Attachments</h3>
              {cardData?.attachments && cardData.attachments.length > 0 ? (
                <div className="attachments-list">
                  {cardData.attachments.map((attachment) => (
                    <div key={attachment.id} className="attachment-item">
                      <button
                        type="button"
                        className="attachment-preview"
                        onClick={() => handleDownloadAttachment(attachment)}
                        title="Open attachment"
                      >
                        {getAttachmentThumbnail(attachment) ? (
                          <img src={getAttachmentThumbnail(attachment)} alt={attachment.file_name} loading="lazy" />
                        ) : (
                          <span>{(attachment.attachment_type || 'file') === 'link' ? 'Link' : 'File'}</span>
                        )}
                      </button>
                      <div className="attachment-details">
                        <button
                          type="button"
                          className="attachment-link"
                          onClick={() => handleDownloadAttachment(attachment)}
                        >
                          📎 {attachment.file_name}
                        </button>
                        <div className="attachment-meta">
                          <span>Added {formatTimestamp(attachment.uploaded_at)}</span>
                          {attachment.is_cover ? <span>Cover</span> : null}
                        </div>
                      </div>
                      <div className="attachment-actions">
                        <button
                          type="button"
                          className="attachment-icon-btn"
                          onClick={() => handleShareAttachment(attachment)}
                          title="Share attachment link"
                          disabled={loading}
                        >
                          Share
                        </button>
                        <div className="attachment-menu-wrap">
                          <button
                            type="button"
                            className="attachment-icon-btn attachment-menu-btn"
                            onClick={() => setOpenAttachmentMenuId((current) => (
                              current === attachment.id ? null : attachment.id
                            ))}
                            title="Attachment options"
                          >
                            ...
                          </button>
                          {openAttachmentMenuId === attachment.id && (
                            <div className="attachment-options-menu">
                              <button type="button" onClick={() => handleRenameAttachment(attachment)}>Edit</button>
                              <button type="button" onClick={() => handleAttachmentComment(attachment)}>Comment</button>
                              <button type="button" onClick={() => handleDownloadAttachment(attachment)}>Download</button>
                              <button type="button" onClick={() => handleMakeAttachmentCover(attachment)}>Make cover</button>
                              <button
                                type="button"
                                className="attachment-options-remove"
                                onClick={() => handleDeleteAttachment(attachment.id)}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                        {user?.role === 'admin' && (
                          <button
                            className="attachment-delete"
                            onClick={() => handleDeleteAttachment(attachment.id)}
                            title="Delete attachment"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="section-note">No attachments yet</p>
              )}
            </section>
          </div>

          <aside className="modal-sidebar card-modal-sidebar">
            <section className="sidebar-section comment-composer-section modal-panel">
              <h3>Comments and Activity</h3>
              <form onSubmit={handleAddComment} className="comment-form">
                <div className="comment-mention-wrapper">
                  <textarea
                    ref={commentTextareaRef}
                    className="modal-textarea comment-textarea"
                    value={newComment}
                    onChange={handleCommentInputChange}
                    onKeyDown={handleCommentKeyDown}
                    onClick={handleCommentInputSelect}
                    onKeyUp={handleCommentInputSelect}
                    placeholder="Write a comment... Type @ to mention members"
                    disabled={loading}
                  />
                  {mentionContext.open && (
                    <div className="mention-dropdown" role="listbox" aria-label="Mention members">
                      {mentionSuggestions.length > 0 ? (
                        mentionSuggestions.map((member, index) => (
                          <button
                            key={member.id || `${member.email}-${member.username}`}
                            type="button"
                            className={`mention-dropdown-item${index === mentionContext.highlightedIndex ? ' active' : ''}`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              insertMention(member);
                            }}
                          >
                            <span className="mention-dropdown-name">{member.display}</span>
                            {member.email && <small className="mention-dropdown-email">{member.email}</small>}
                          </button>
                        ))
                      ) : (
                        <div className="mention-dropdown-empty">No members found</div>
                      )}
                    </div>
                  )}
                </div>
                <button type="submit" className="btn btn-add-comment" disabled={loading || !newComment.trim()}>
                  Add Comment
                </button>
              </form>
            </section>

            <section className="sidebar-section discussion-list-section">
              <div className="discussion-block">
                <h4>Comments</h4>
                {cardData.comments?.length > 0 ? (
                  <div className="discussion-list comments-list">
                    {cardData.comments.map((comment) => (
                      <article key={comment.id} className="discussion-item comment-item">
                        <div className="discussion-meta">
                          <strong>{comment.username || comment.email}</strong>
                          <span>{formatTimestamp(comment.created_at)}</span>
                        </div>
                        <p>{comment.content}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="section-note">No comments yet</p>
                )}
              </div>

              <div className="discussion-block">
                <h4>Activity</h4>
                {cardData.activity?.length > 0 ? (
                  <div className="discussion-list activity-list">
                    {cardData.activity.map((entry) => (
                      <article key={entry.id} className="discussion-item activity-item">
                        <div className="discussion-meta">
                          <strong>{entry.username || 'System'}</strong>
                          <span>{formatTimestamp(entry.created_at)}</span>
                        </div>
                        <p>{entry.message}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="section-note">No activity yet</p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default CardModal;
