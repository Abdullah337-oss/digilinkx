import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import Card from '../components/Card';
import CardModal from '../components/CardModal';
import ChangePassword from '../components/ChangePassword';
import AddMember from '../components/AddMember';
import ViewMembers from '../components/ViewMembers';
import ConnectionSettings from '../components/ConnectionSettings';
import NotificationCenter from '../components/NotificationCenter';
import '../styles/Dashboard.css';

const DASHBOARD_BACKGROUND_THEMES = [
  'bg-theme-1',
  'bg-theme-2',
  'bg-theme-3',
  'bg-theme-4',
  'bg-theme-5'
];
const DASHBOARD_BACKGROUND_STORAGE_KEY = 'dashboardBackgroundRotation';
const BACKGROUND_ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_BACKGROUND_SWITCH_HOUR = 21;
const ADMIN_NOTIFICATION_ACTIONS = new Set(['card_created', 'attachment_uploaded']);
const NOTIFICATION_DURATION_MS = 10000;
const DASHBOARD_NOTIFICATION_POLL_MS = 5000;

function Dashboard({ user, onLogout }) {
  // Each entry: { id, title, created_at, flatCards: [...], firstListId }
  const [boards, setBoards] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvalRoles, setApprovalRoles] = useState({});
  const [approvalBoards, setApprovalBoards] = useState({});
  const [processingUserId, setProcessingUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedCardBoardId, setSelectedCardBoardId] = useState(null);
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [boardMembers, setBoardMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Board title editing (per-board, click-to-edit)
  const [editingBoardId, setEditingBoardId] = useState(null);
  const [editedBoardTitle, setEditedBoardTitle] = useState('');
  const savingBoardRef = useRef(null);

  // Board creation ("+ Add another list")
  const [showAddBoardForm, setShowAddBoardForm] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [backgroundThemeIndex, setBackgroundThemeIndex] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showViewMembers, setShowViewMembers] = useState(false);
  const [showPendingRequestModal, setShowPendingRequestModal] = useState(false);
  const [showConnectionSettings, setShowConnectionSettings] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showMoveSection, setShowMoveSection] = useState(false);
  const [moveDraftBoards, setMoveDraftBoards] = useState([]);
  const [savingMoveOrder, setSavingMoveOrder] = useState(false);

  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);
  const seenActivityIdsRef = useRef(new Set());
  const notificationsInitializedRef = useRef(false);
  const notificationTimeoutsRef = useRef(new Map());

  useEffect(() => {
    seenActivityIdsRef.current = new Set();
    notificationsInitializedRef.current = false;
    notificationTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    notificationTimeoutsRef.current.clear();
    setNotifications([]);

    fetchAllBoards();
    if (isAdmin) fetchPendingUsers();

    const storedDarkMode = localStorage.getItem('dashboardDarkMode');
    if (storedDarkMode === 'true') {
      setIsDarkMode(true);
    }
  }, [isAdmin, user?.id]);

  useEffect(() => () => {
    notificationTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    notificationTimeoutsRef.current.clear();
  }, []);

  useEffect(() => {
    const handleClickOutsideProfile = (event) => {
      if (showProfileMenu && profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutsideProfile);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideProfile);
    };
  }, [showProfileMenu]);

  useEffect(() => {
    if (!pendingUsers.length || !boards.length) return;

    setApprovalBoards((prev) => {
      const next = { ...prev };
      pendingUsers.forEach((pu) => {
        const current = new Set(prev[pu.id] || []);
        boards.forEach((board) => current.add(board.id));
        next[pu.id] = [...current];
      });
      return next;
    });
  }, [boards, pendingUsers]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchAllBoards({ silent: true });
    }, DASHBOARD_NOTIFICATION_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const existingCardIds = new Set(
      boards.flatMap((board) => (board.flatCards || []).map((card) => card.id))
    );

    setSelectedCardIds((prev) => prev.filter((id) => existingCardIds.has(id)));
  }, [boards]);

  useEffect(() => {
    localStorage.setItem('dashboardDarkMode', isDarkMode ? 'true' : 'false');
  }, [isDarkMode]);

  useEffect(() => {
    if (!showMoveSection) {
      setMoveDraftBoards(boards.map((board) => ({ id: board.id, title: board.title })));
    }
  }, [boards, showMoveSection]);

  useEffect(() => {
    const totalThemes = DASHBOARD_BACKGROUND_THEMES.length;
    const now = Date.now();
    let timeoutId;

    const getMostRecentNinePmTimestamp = (currentTimestamp) => {
      const boundary = new Date(currentTimestamp);
      boundary.setHours(DASHBOARD_BACKGROUND_SWITCH_HOUR, 0, 0, 0);

      if (currentTimestamp < boundary.getTime()) {
        boundary.setDate(boundary.getDate() - 1);
      }

      return boundary.getTime();
    };

    const getNextNinePmTimestamp = () => {
      const next = new Date();
      next.setHours(DASHBOARD_BACKGROUND_SWITCH_HOUR, 0, 0, 0);

      if (Date.now() >= next.getTime()) {
        next.setDate(next.getDate() + 1);
      }

      return next.getTime();
    };

    let rotationState = {
      index: 0,
      lastChangedAt: getMostRecentNinePmTimestamp(now),
    };

    try {
      const saved = JSON.parse(localStorage.getItem(DASHBOARD_BACKGROUND_STORAGE_KEY) || '{}');
      const savedIndex = Number(saved.index);
      const savedTimestamp = Number(saved.lastChangedAt);

      if (Number.isInteger(savedIndex) && Number.isFinite(savedTimestamp) && savedTimestamp > 0) {
        rotationState = {
          index: Math.abs(savedIndex) % totalThemes,
          lastChangedAt: savedTimestamp,
        };
      }
    } catch (storageErr) {
      // Ignore storage parsing failures and fall back to defaults.
    }

    const mostRecentNinePm = getMostRecentNinePmTimestamp(now);
    const elapsedMs = mostRecentNinePm - rotationState.lastChangedAt;
    if (elapsedMs >= BACKGROUND_ROTATION_INTERVAL_MS) {
      const steps = Math.floor(elapsedMs / BACKGROUND_ROTATION_INTERVAL_MS);
      rotationState = {
        index: (rotationState.index + steps) % totalThemes,
        lastChangedAt: rotationState.lastChangedAt + steps * BACKGROUND_ROTATION_INTERVAL_MS,
      };
    }

    setBackgroundThemeIndex(rotationState.index);
    localStorage.setItem(DASHBOARD_BACKGROUND_STORAGE_KEY, JSON.stringify(rotationState));

    const scheduleNextThemeChange = () => {
      const remainingMs = Math.max(1000, getNextNinePmTimestamp() - Date.now());

      timeoutId = setTimeout(() => {
        rotationState = {
          index: (rotationState.index + 1) % totalThemes,
          lastChangedAt: getMostRecentNinePmTimestamp(Date.now()),
        };

        setBackgroundThemeIndex(rotationState.index);
        localStorage.setItem(DASHBOARD_BACKGROUND_STORAGE_KEY, JSON.stringify(rotationState));
        scheduleNextThemeChange();
      }, remainingMs);
    };

    scheduleNextThemeChange();

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  // ── Data helpers ───────────────────────────────────────────────────────────

  // Merge card-detail data, flatten all cards across lists, find firstListId
  const enrichBoard = async (boardData, token) => {
    const allCards = (boardData?.lists || []).flatMap((l) => l.cards || []);

    if (allCards.length > 0) {
      const detailResults = await Promise.allSettled(
        allCards.map((c) =>
          axios.get(`/api/cards/${c.id}`, { headers: { Authorization: `Bearer ${token}` } })
        )
      );

      const detailsMap = new Map();
      detailResults.forEach((r) => {
        if (r.status === 'fulfilled' && r.value?.data?.id) {
          detailsMap.set(r.value.data.id, r.value.data);
        }
      });

      boardData.lists = (boardData.lists || []).map((list) => ({
        ...list,
        cards: (list.cards || []).map((card) => {
          const details = detailsMap.get(card.id);
          if (!details) return { ...card, boardId: boardData.id };
          const memberUsernames = (details.members || [])
            .map((m) => m.username || m.email)
            .filter(Boolean);
          return {
            ...card,
            boardId: boardData.id,
            labels: details.labels || card.labels || [],
            members: details.members || card.members || [],
            attachments: details.attachments || card.attachments || [],
            activity: details.activity || card.activity || [],
            memberUsernames:
              memberUsernames.length ? memberUsernames : (card.memberUsernames || []),
            dates: details.dates || card.dates || null,
            due_date: details.dates?.due_date || card.due_date || null,
            due_time: details.dates?.due_time || card.due_time || null,
          };
        }),
      }));
    }

    // Sort lists by position so firstListId is the designated default list
    const sortedLists = [...(boardData.lists || [])].sort((a, b) => {
      const pa = Number.isInteger(a.position) ? a.position : 999;
      const pb = Number.isInteger(b.position) ? b.position : 999;
      return pa !== pb ? pa - pb : a.id - b.id;
    });

    const flatCards = sortedLists.flatMap((l) =>
      (l.cards || []).map((c) => ({ ...c, boardId: boardData.id }))
    );
    const firstListId = sortedLists[0]?.id || null;

    return { ...boardData, flatCards, firstListId };
  };

  const dismissNotification = (notificationId) => {
    const timeoutId = notificationTimeoutsRef.current.get(notificationId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      notificationTimeoutsRef.current.delete(notificationId);
    }

    setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId));
  };

  const queueNotification = (title, message) => {
    const notificationId = `dashboard-notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setNotifications((prev) => [
      ...prev,
      {
        id: notificationId,
        title,
        message,
      },
    ]);

    const timeoutId = window.setTimeout(() => {
      dismissNotification(notificationId);
    }, NOTIFICATION_DURATION_MS);

    notificationTimeoutsRef.current.set(notificationId, timeoutId);
  };

  const processBoardNotifications = (enrichedBoards) => {
    const activityEntries = enrichedBoards.flatMap((board) =>
      (board.flatCards || []).flatMap((card) =>
        (card.activity || [])
          .filter(
            (entry) => ADMIN_NOTIFICATION_ACTIONS.has(entry.action_type) && entry.role === 'admin'
          )
          .map((entry) => ({
            id: String(entry.id),
            actorId: entry.user_id,
            actorName: entry.username || 'Admin',
            actionType: entry.action_type,
            boardTitle: board.title,
            cardTitle: card.title || 'Untitled card',
            createdAt: entry.created_at || '',
          }))
      )
    );

    activityEntries.sort((a, b) => {
      const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }

      return Number(a.id) - Number(b.id);
    });

    if (!notificationsInitializedRef.current) {
      activityEntries.forEach((entry) => seenActivityIdsRef.current.add(entry.id));
      notificationsInitializedRef.current = true;
      return;
    }

    activityEntries.forEach((entry) => {
      if (seenActivityIdsRef.current.has(entry.id)) {
        return;
      }

      seenActivityIdsRef.current.add(entry.id);

      if (String(entry.actorId) === String(user?.id)) {
        return;
      }

      if (entry.actionType === 'card_created') {
        queueNotification(
          'New Card',
          `${entry.actorName} created "${entry.cardTitle}" in ${entry.boardTitle}.`
        );
        return;
      }

      if (entry.actionType === 'attachment_uploaded') {
        queueNotification(
          'New Attachment',
          `${entry.actorName} uploaded an attachment to "${entry.cardTitle}".`
        );
      }
    });
  };

  const fetchAllBoards = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const token = localStorage.getItem('token');
      const listRes = await axios.get('/api/boards', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const boardList = listRes.data || [];

      const detailResults = await Promise.allSettled(
        boardList.map((b) =>
          axios.get(`/api/boards/${b.id}`, { headers: { Authorization: `Bearer ${token}` } })
        )
      );

      const enriched = await Promise.all(
        detailResults
          .filter((r) => r.status === 'fulfilled')
          .map((r) => enrichBoard(r.value.data, token))
      );

      processBoardNotifications(enriched);
      setBoards(enriched);
      setError('');
    } catch (err) {
      if (!silent) {
        setError('Failed to load boards');
      }
      console.error(err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const refreshBoard = async (boardId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/boards/${boardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const enriched = await enrichBoard(res.data, token);
      processBoardNotifications([enriched]);
      setBoards((prev) => prev.map((b) => (b.id === boardId ? enriched : b)));
    } catch (err) {
      console.error('Failed to refresh board', boardId, err);
    }
  };

  const handleCardUpdate = (updatedCard) => {
    if (!selectedCardBoardId) {
      return;
    }

    if (!updatedCard?.id) {
      refreshBoard(selectedCardBoardId);
      return;
    }

    const memberUsernames = (updatedCard.members || [])
      .map((member) => member.username || member.email)
      .filter(Boolean);

    const normalizedUpdatedCard = {
      ...updatedCard,
      boardId: selectedCardBoardId,
      attachments: updatedCard.attachments || [],
      labels: updatedCard.labels || [],
      members: updatedCard.members || [],
      activity: updatedCard.activity || [],
      memberUsernames,
      dates: updatedCard.dates || null,
      due_date: updatedCard.dates?.due_date || updatedCard.due_date || null,
      due_time: updatedCard.dates?.due_time || updatedCard.due_time || null,
    };

    setBoards((prevBoards) => prevBoards.map((board) => {
      if (board.id !== selectedCardBoardId) {
        return board;
      }

      const updatedLists = (board.lists || []).map((list) => ({
        ...list,
        cards: (list.cards || []).map((card) => (
          card.id === normalizedUpdatedCard.id
            ? { ...card, ...normalizedUpdatedCard }
            : card
        )),
      }));

      const updatedFlatCards = (board.flatCards || []).map((card) => (
        card.id === normalizedUpdatedCard.id
          ? { ...card, ...normalizedUpdatedCard }
          : card
      ));

      return {
        ...board,
        lists: updatedLists,
        flatCards: updatedFlatCards,
      };
    }));

    setSelectedCard((prevCard) => (
      prevCard?.id === normalizedUpdatedCard.id
        ? { ...prevCard, ...normalizedUpdatedCard }
        : prevCard
    ));
  };

  // ── Pending users ──────────────────────────────────────────────────────────

  const fetchPendingUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/users/pending', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPendingUsers(response.data || []);
      setApprovalRoles((prev) => {
        const next = { ...prev };
        (response.data || []).forEach((pu) => {
          if (!next[pu.id]) next[pu.id] = 'viewer';
        });
        return next;
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load pending users');
    }
  };

  const handleApproveUser = async (pendingUserId) => {
    try {
      setProcessingUserId(pendingUserId);
      const token = localStorage.getItem('token');
      const role = approvalRoles[pendingUserId] === 'admin' ? 'admin' : 'viewer';
      const selectedBoards = approvalBoards[pendingUserId] || boards.map((board) => board.id);
      await axios.patch(
        `/api/users/${pendingUserId}/approve`,
        { role, boardIds: selectedBoards },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchPendingUsers();
      setError('');
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve user');
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleRejectUser = async (pendingUserId) => {
    try {
      setProcessingUserId(pendingUserId);
      const token = localStorage.getItem('token');
      await axios.patch(
        `/api/users/${pendingUserId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchPendingUsers();
      setError('');
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject user');
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  const openPendingRequestModal = () => {
    setShowPendingRequestModal(true);
    setShowProfileMenu(false);
  };

  const closePendingRequestModal = () => {
    setShowPendingRequestModal(false);
  };


  // ── Boards ─────────────────────────────────────────────────────────────────

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    const trimmed = newBoardTitle.trim();
    if (!trimmed) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        '/api/boards',
        { title: trimmed },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewBoardTitle('');
      setShowAddBoardForm(false);
      const newBoardId = res.data?.board?.id || res.data?.boardId;
      if (newBoardId) {
        const detailRes = await axios.get(`/api/boards/${newBoardId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const enriched = await enrichBoard(detailRes.data, token);
        setBoards((prev) => [...prev, enriched]);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create board');
    }
  };

  const handleDeleteBoard = async (boardId) => {
    if (!window.confirm('Are you sure you want to delete this board?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/boards/${boardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
      setError('');
    } catch (err) {
      setError('Failed to delete board');
    }
  };

  const saveBoardTitle = async (boardId) => {
    if (savingBoardRef.current === boardId) return;
    const trimmed = editedBoardTitle.trim();
    setEditingBoardId(null);
    if (!trimmed) return;
    const original = boards.find((b) => b.id === boardId)?.title || '';
    if (trimmed === original) return;

    savingBoardRef.current = boardId;
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `/api/boards/${boardId}`,
        { title: trimmed },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBoards((prev) =>
        prev.map((b) => (b.id === boardId ? { ...b, title: trimmed } : b))
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update board title');
      await refreshBoard(boardId);
    } finally {
      savingBoardRef.current = null;
      setEditedBoardTitle('');
    }
  };

  const handleBoardTitleKeyDown = (e, boardId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBoardTitle(boardId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingBoardId(null);
      setEditedBoardTitle('');
    }
  };

  // ── Cards ──────────────────────────────────────────────────────────────────

  const handleCreateCard = async (boardId) => {
    const board = boards.find((b) => b.id === boardId);
    if (!board?.firstListId) {
      setError('This board has no list yet — please refresh or recreate the board.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const createResponse = await axios.post(
        '/api/cards',
        { listId: board.firstListId, title: 'Untitled card', description: '' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const createdCardId = createResponse.data?.cardId;
      if (!createdCardId) {
        await refreshBoard(boardId);
        return;
      }

      const [membersResponse, cardResponse] = await Promise.all([
        axios.get(`/api/boards/${boardId}/members`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/cards/${createdCardId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setBoardMembers(membersResponse.data || []);

      const createdCard = {
        ...cardResponse.data,
        boardId,
        attachments: cardResponse.data.attachments || [],
        comments: cardResponse.data.comments || [],
        activity: cardResponse.data.activity || [],
        __startInTitleEdit: true,
      };

      setSelectedCardBoardId(boardId);
      setSelectedCard(createdCard);
      queueNotification('Card Created', `Your new card was added to ${board.title}.`);
      await refreshBoard(boardId);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create card');
    }
  };

  const handleDeleteCard = async (cardId, boardId) => {
    if (!window.confirm('Are you sure you want to delete this card?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/cards/${cardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedCardIds((prev) => prev.filter((id) => id !== cardId));
      await refreshBoard(boardId);
      setSelectedCard(null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete card');
    }
  };

  const deleteCardsByIds = async (cardIds) => {
    const cardBoardPairs = cardIds
      .map((cardId) => {
        for (const board of boards) {
          if ((board.flatCards || []).some((card) => card.id === cardId)) {
            return { cardId, boardId: board.id };
          }
        }
        return null;
      })
      .filter(Boolean);

    if (!cardBoardPairs.length) {
      return { deletedCount: 0, failedCount: 0 };
    }

    const token = localStorage.getItem('token');
    let failedCount = 0;

    for (const { cardId } of cardBoardPairs) {
      try {
        await axios.delete(`/api/cards/${cardId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        failedCount += 1;
      }
    }

    const boardIdsToRefresh = [...new Set(cardBoardPairs.map((pair) => pair.boardId))];
    await Promise.all(boardIdsToRefresh.map((id) => refreshBoard(id)));

    if (selectedCard && cardBoardPairs.some((pair) => pair.cardId === selectedCard.id)) {
      setSelectedCard(null);
    }

    return {
      deletedCount: cardBoardPairs.length - failedCount,
      failedCount,
    };
  };

  const toggleCardSelection = (cardId) => {
    setSelectedCardIds((prev) => (
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    ));
  };

  const handleBulkDeleteCards = async () => {
    if (!selectedCardIds.length) return;

    const idsToDelete = [...selectedCardIds];
    if (!window.confirm(`Delete ${idsToDelete.length} selected card(s)?`)) {
      return;
    }

    try {
      const { deletedCount, failedCount } = await deleteCardsByIds(idsToDelete);
      setSelectedCardIds([]);

      if (failedCount > 0) {
        setError(`Deleted ${deletedCount} card(s). ${failedCount} failed.`);
      } else {
        setError('');
      }
    } catch (err) {
      setError('Failed to delete selected cards');
    }
  };


  const handleCardClick = async (card) => {
    const boardId = card.boardId;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/boards/${boardId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBoardMembers(res.data || []);
    } catch {
      setBoardMembers([]);
    }
    setSelectedCardBoardId(boardId);
    setSelectedCard(card);
  };

  const toggleMoveSection = () => {
    if (!isAdmin) return;
    setMoveDraftBoards(boards.map((board) => ({ id: board.id, title: board.title })));
    setShowMoveSection((prev) => !prev);
  };

  const handleMoveSectionDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.index === destination.index) return;

    setMoveDraftBoards((current) => {
      const next = Array.from(current);
      const [movedBoard] = next.splice(source.index, 1);
      next.splice(destination.index, 0, movedBoard);
      return next;
    });
  };

  const handleSaveMoveOrder = async () => {
    if (!isAdmin || moveDraftBoards.length === 0) return;

    const reorderedBoards = moveDraftBoards
      .map((draftBoard) => boards.find((board) => board.id === draftBoard.id))
      .filter(Boolean);

    if (reorderedBoards.length !== boards.length) {
      setError('List order changed while editing. Please try again.');
      setMoveDraftBoards(boards.map((board) => ({ id: board.id, title: board.title })));
      return;
    }

    setSavingMoveOrder(true);
    setBoards(reorderedBoards.map((board, index) => ({ ...board, position: index })));

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        '/api/boards/reorder',
        { boardIds: moveDraftBoards.map((board) => board.id) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowMoveSection(false);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save list order');
      fetchAllBoards();
    } finally {
      setSavingMoveOrder(false);
    }
  };

  const handleBoardColumnDragStart = (boardId, event) => {
    if (!isAdmin || editingBoardId === boardId) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(boardId));
  };

  const handleBoardColumnDrop = async (targetBoardId, event) => {
    event.preventDefault();
    if (!isAdmin) return;

    const sourceBoardId = Number(event.dataTransfer.getData('text/plain'));
    if (!sourceBoardId || sourceBoardId === targetBoardId) return;

    const sourceIndex = boards.findIndex((board) => board.id === sourceBoardId);
    const targetIndex = boards.findIndex((board) => board.id === targetBoardId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const reorderedBoards = Array.from(boards);
    const [movedBoard] = reorderedBoards.splice(sourceIndex, 1);
    reorderedBoards.splice(targetIndex, 0, movedBoard);
    setBoards(reorderedBoards.map((board, index) => ({ ...board, position: index })));

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        '/api/boards/reorder',
        { boardIds: reorderedBoards.map((board) => board.id) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to move list');
      fetchAllBoards();
    }
  };

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId, type } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    if (type === 'BOARD') {
      if (!isAdmin) return;

      const reorderedBoards = Array.from(boards);
      const [movedBoard] = reorderedBoards.splice(source.index, 1);
      reorderedBoards.splice(destination.index, 0, movedBoard);

      setBoards(reorderedBoards.map((board, index) => ({ ...board, position: index })));

      try {
        const token = localStorage.getItem('token');
        await axios.put(
          '/api/boards/reorder',
          { boardIds: reorderedBoards.map((board) => board.id) },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to move list');
        fetchAllBoards();
      }
      return;
    }

    if (type !== 'CARD') {
      return;
    }

    const destBoardId = parseInt(destination.droppableId.replace('board-', ''), 10);
    const srcBoardId = parseInt(source.droppableId.replace('board-', ''), 10);
    const destBoard = boards.find((b) => b.id === destBoardId);
    if (!destBoard?.firstListId) return;

    const previousBoards = boards;
    setBoards((currentBoards) => {
      const nextBoards = currentBoards.map((board) => ({
        ...board,
        flatCards: [...(board.flatCards || [])],
      }));

      const sourceBoard = nextBoards.find((board) => board.id === srcBoardId);
      const destinationBoard = nextBoards.find((board) => board.id === destBoardId);
      if (!sourceBoard || !destinationBoard) {
        return currentBoards;
      }

      const [movedCard] = sourceBoard.flatCards.splice(source.index, 1);
      if (!movedCard) {
        return currentBoards;
      }

      destinationBoard.flatCards.splice(destination.index, 0, {
        ...movedCard,
        boardId: destBoardId,
        list_id: destinationBoard.firstListId || movedCard.list_id,
      });

      return nextBoards;
    });

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `/api/cards/${parseInt(draggableId, 10)}/move`,
        { listId: destBoard.firstListId, position: destination.index },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const toRefresh =
        srcBoardId === destBoardId ? [srcBoardId] : [srcBoardId, destBoardId];
      await Promise.all(toRefresh.map(refreshBoard));
    } catch (err) {
      setBoards(previousBoards);
      setError('Failed to move card');
    }
  };

  // ── Misc ───────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const allCards = boards.flatMap((board) => board.flatCards || []);
  const filteredCards = normalizedSearchTerm
    ? allCards.filter((card) =>
        [card.title, card.description, card.notes]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearchTerm)
      )
    : [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`dashboard ${DASHBOARD_BACKGROUND_THEMES[backgroundThemeIndex]}${isDarkMode ? ' dark-mode' : ''}`}>
      <NotificationCenter notifications={notifications} onDismiss={dismissNotification} />
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo-wrap">
            <img
              src="/api/assets/dashboard_logo"
              alt="Digilinkx logo"
              className="app-logo"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = '/Logo-new.svg?v=1';
              }}
            />
            <h1>Digilinkx Todo App</h1>
          </div>

          <div className="header-search">
            <input
              type="text"
              placeholder="Search cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search cards"
            />
            {searchTerm.trim() && (
              <div className="search-dropdown">
                <div className="search-dropdown-header">
                  <h4>Search results ({filteredCards.length})</h4>
                </div>
                {filteredCards.length === 0 ? (
                  <div className="search-no-results">
                    <p>No cards found.</p>
                  </div>
                ) : (
                  <div className="search-dropdown-list">
                    {filteredCards.map((card) => (
                      <div
                        key={card.id}
                        className="search-card-item"
                        onClick={() => {
                          handleCardClick(card);
                          setSearchTerm('');
                        }}
                      >
                        <div className="search-card-title">{card.title}</div>
                        <div className="search-card-meta">
                          {card.description && (
                            <span className="search-card-desc">{card.description.substring(0, 50)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="user-info">
            <label className="theme-switch">
              <span className={`theme-switch-label left ${isDarkMode ? 'active' : ''}`}>
                Dark Mode
              </span>
              <input
                type="checkbox"
                checked={!isDarkMode}
                onChange={(e) => setIsDarkMode(!e.target.checked)}
                aria-label="Toggle dark mode"
              />
              <span className="slider" />
              <span className={`theme-switch-label right ${isDarkMode ? '' : 'active'}`}>
                Light Mode
              </span>
            </label>
            <div className="profile-area">
              <span>
                Welcome, <strong>{user?.username}</strong>
              </span>

              <button
                type="button"
                className="profile-avatar-btn"
                onClick={() => setShowProfileMenu((prev) => !prev)}
              >
                {user?.username ? user.username.slice(0, 2).toUpperCase() : 'NA'}
              </button>

              {showProfileMenu && (
                <div className="profile-dropdown" ref={profileMenuRef}>
                  {isAdmin && (
                    <div className="profile-dropdown-section">
                      <button
                        type="button"
                        className="profile-dropdown-move-toggle"
                        onClick={toggleMoveSection}
                      >
                        Move
                      </button>
                      {showMoveSection && (
                        <div className="profile-move-panel">
                          <DragDropContext onDragEnd={handleMoveSectionDragEnd}>
                            <Droppable droppableId="profile-move-list" type="PROFILE_MOVE_LIST">
                              {(provided) => (
                                <div
                                  className="profile-move-list"
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                >
                                  {moveDraftBoards.map((board, index) => (
                                    <Draggable
                                      key={board.id}
                                      draggableId={`profile-move-${board.id}`}
                                      index={index}
                                    >
                                      {(dragProvided, snapshot) => (
                                        <div
                                          ref={dragProvided.innerRef}
                                          {...dragProvided.draggableProps}
                                          {...dragProvided.dragHandleProps}
                                          className={`profile-move-item${snapshot.isDragging ? ' dragging' : ''}`}
                                        >
                                          <span className="profile-move-grip">::</span>
                                          <span className="profile-move-title">{board.title}</span>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </DragDropContext>
                          <div className="profile-move-actions">
                            <button
                              type="button"
                              className="profile-move-cancel"
                              onClick={() => {
                                setShowMoveSection(false);
                                setMoveDraftBoards(boards.map((board) => ({ id: board.id, title: board.title })));
                              }}
                              disabled={savingMoveOrder}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="profile-move-save"
                              onClick={handleSaveMoveOrder}
                              disabled={savingMoveOrder || moveDraftBoards.length === 0}
                            >
                              {savingMoveOrder ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="pending-requests-toggle"
                        onClick={openPendingRequestModal}
                      >
                        Pending Requests ({pendingUsers.length})
                      </button>
                      <button
                        type="button"
                        className="profile-dropdown-add-member"
                        onClick={() => {
                          setShowAddMember(true);
                          setShowProfileMenu(false);
                        }}
                      >
                        Add Member
                      </button>
                      <button
                        type="button"
                        className="profile-dropdown-view-members"
                        onClick={() => {
                          setShowViewMembers(true);
                          setShowProfileMenu(false);
                        }}
                      >
                        View Members
                      </button>
                      <button
                        type="button"
                        className="profile-dropdown-history"
                        onClick={() => {
                          navigate('/history');
                          setShowProfileMenu(false);
                        }}
                      >
                        History
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePassword(true);
                      setShowProfileMenu(false);
                    }}
                  >
                    Change Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowConnectionSettings(true);
                      setShowProfileMenu(false);
                    }}
                  >
                    Connection Settings
                  </button>
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

      <main className="dashboard-main">
        {error && (
          <div className="error-message dashboard-error">{error}</div>
        )}

        {showChangePassword && (
          <ChangePassword user={user} onClose={() => setShowChangePassword(false)} />
        )}

        {showAddMember && (
          <AddMember onClose={() => setShowAddMember(false)} onNotify={queueNotification} />
        )}

        {showViewMembers && (
          <ViewMembers onClose={() => setShowViewMembers(false)} onNotify={queueNotification} />
        )}

        {showConnectionSettings && (
          <ConnectionSettings onClose={() => setShowConnectionSettings(false)} />
        )}

        {showPendingRequestModal && (
          <div className="pending-request-modal-overlay" onClick={closePendingRequestModal}>
            <div className="pending-request-modal" onClick={(e) => e.stopPropagation()}>
              <div className="pending-request-modal-header">
                <h3>Pending Requests</h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={closePendingRequestModal}
                  aria-label="Close pending requests details"
                >
                  ×
                </button>
              </div>
              <div className="pending-request-modal-body">
                {pendingUsers.length === 0 ? (
                  <div className="empty-state compact">
                    <p>No pending requests</p>
                  </div>
                ) : (
                  <div className="pending-users-list pending-request-modal-list">
                    {pendingUsers.map((pu) => (
                      <div key={pu.id} className="pending-user-item">
                        <div className="pending-user-info">
                          <strong>{pu.username}</strong>
                          <span>{pu.email}</span>
                        </div>
                        <div className="pending-request-meta">
                          <span>Requested {new Date(pu.created_at).toLocaleString()}</span>
                          <span>Status: Pending</span>
                        </div>
                        <div className="pending-user-actions">
                          <select
                            value={approvalRoles[pu.id] || 'viewer'}
                            onChange={(e) =>
                              setApprovalRoles((prev) => ({
                                ...prev,
                                [pu.id]: e.target.value,
                              }))
                            }
                            disabled={processingUserId === pu.id}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button
                            type="button"
                            className="btn btn-success"
                            onClick={() => handleApproveUser(pu.id)}
                            disabled={processingUserId === pu.id}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-cancel"
                            onClick={() => handleRejectUser(pu.id)}
                            disabled={processingUserId === pu.id}
                          >
                            Reject
                          </button>
                        </div>
                        <div className="pending-request-board-selection">
                          <label>Board access</label>
                          <div className="pending-request-board-list">
                            {boards.length === 0 ? (
                              <div className="empty-state compact">
                                <p>No boards available to assign yet.</p>
                              </div>
                            ) : (
                              boards.map((board) => {
                                const selectedBoards = approvalBoards[pu.id] || boards.map((item) => item.id);
                                const isSelected = selectedBoards.includes(board.id);

                                return (
                                  <label key={board.id} className="pending-board-checkbox">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        setApprovalBoards((prev) => {
                                          const current = new Set(prev[pu.id] || boards.map((item) => item.id));
                                          if (current.has(board.id)) {
                                            current.delete(board.id);
                                          } else {
                                            current.add(board.id);
                                          }
                                          return {
                                            ...prev,
                                            [pu.id]: [...current],
                                          };
                                        });
                                      }}
                                      disabled={processingUserId === pu.id}
                                    />
                                    {board.title}
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isAdmin && selectedCardIds.length > 0 && (
          <div className="dashboard-card-actions">
            <button
              className="btn btn-danger bulk-delete-btn"
              onClick={handleBulkDeleteCards}
            >
              Delete Selected ({selectedCardIds.length})
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="boards-canvas">
              {boards.map((board) => (
                <Droppable key={board.id} droppableId={`board-${board.id}`} type="CARD">
                  {(provided, snapshot) => (
                    <div
                      className={`board-column${snapshot.isDraggingOver ? ' dragging-over' : ''}`}
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                      <div
                        className="board-column-header"
                        draggable={isAdmin && editingBoardId !== board.id}
                        onDragStart={(event) => handleBoardColumnDragStart(board.id, event)}
                        onDragOver={(event) => {
                          if (isAdmin) event.preventDefault();
                        }}
                        onDrop={(event) => handleBoardColumnDrop(board.id, event)}
                      >
                        {isAdmin && editingBoardId === board.id ? (
                          <input
                            className="board-column-title-input"
                            type="text"
                            value={editedBoardTitle}
                            onChange={(e) => setEditedBoardTitle(e.target.value)}
                            onBlur={() => saveBoardTitle(board.id)}
                            onKeyDown={(e) => handleBoardTitleKeyDown(e, board.id)}
                            maxLength={100}
                            autoFocus
                          />
                        ) : (
                          <h3
                            className={`board-column-title${
                              isAdmin ? ' editable-board-title' : ''
                            }`}
                            onClick={() => {
                              if (!isAdmin) return;
                              setEditingBoardId(board.id);
                              setEditedBoardTitle(board.title);
                            }}
                            title={isAdmin ? 'Click to edit or drag header to move' : undefined}
                          >
                            {board.title}
                          </h3>
                        )}
                        {isAdmin && editingBoardId !== board.id && (
                          <button
                            type="button"
                            className="list-menu-btn"
                            title="Delete board"
                            onClick={() => handleDeleteBoard(board.id)}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="board-cards-container">
                        {(board.flatCards || []).map((card, index) => (
                          <Draggable
                            key={card.id}
                            draggableId={String(card.id)}
                            index={index}
                          >
                            {(dp, ds) => (
                              <div
                                ref={dp.innerRef}
                                {...dp.draggableProps}
                                className={`card-draggable-shell${ds.isDragging ? ' dragging' : ''}`}
                              >
                                <div
                                  className="card-drag-handle"
                                  {...dp.dragHandleProps}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`Drag card ${card.title}`}
                                  title="Drag card"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  ::
                                </div>
                                <Card
                                  card={card}
                                  onClick={() => handleCardClick(card)}
                                  onDelete={() => handleDeleteCard(card.id, board.id)}
                                  canDelete={isAdmin}
                                  showSelectControl={isAdmin}
                                  isSelected={selectedCardIds.includes(card.id)}
                                  onToggleSelect={() => toggleCardSelection(card.id)}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>

                      {isAdmin && (
                        <div className="list-add-card-area">
                          <button
                            type="button"
                            className="list-add-card-btn"
                            onClick={() => handleCreateCard(board.id)}
                          >
                            + Add a card
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              ))}

              {isAdmin && (
                <div className="list-add-placeholder">
                  {showAddBoardForm ? (
                    <form className="list-add-form" onSubmit={handleCreateBoard}>
                      <input
                        type="text"
                        className="list-add-input"
                        placeholder="Enter board title..."
                        value={newBoardTitle}
                        onChange={(e) => setNewBoardTitle(e.target.value)}
                        autoFocus
                        maxLength={100}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setShowAddBoardForm(false);
                            setNewBoardTitle('');
                          }
                        }}
                      />
                      <div className="list-add-form-btns">
                        <button type="submit" className="btn btn-small btn-success">
                          Add board
                        </button>
                        <button
                          type="button"
                          className="btn btn-small btn-cancel"
                          onClick={() => {
                            setShowAddBoardForm(false);
                            setNewBoardTitle('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="list-add-placeholder-btn"
                      onClick={() => setShowAddBoardForm(true)}
                    >
                      + Add another list
                    </button>
                  )}
                </div>
              )}

              {boards.length === 0 && !loading && (
                <p className="empty-canvas-msg">
                  {isAdmin
                    ? 'No boards yet. Click "+ Add another list" to create one.'
                    : 'No boards available yet.'}
                </p>
              )}
            </div>
          </DragDropContext>
        )}
      </main>

      {selectedCard && (
        <CardModal
          card={selectedCard}
          user={user}
          boardMembers={boardMembers}
          onNotify={queueNotification}
          onClose={() => setSelectedCard(null)}
          onCardUpdate={handleCardUpdate}
          onCardDelete={() =>
            handleDeleteCard(selectedCard.id, selectedCardBoardId)
          }
          canDelete={isAdmin || selectedCard.created_by_id === user?.id}
          startInTitleEdit={Boolean(selectedCard?.__startInTitleEdit)}
        />
      )}
    </div>
  );
}

export default Dashboard;
