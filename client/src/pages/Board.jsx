import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import Card from '../components/Card';
import CardModal from '../components/CardModal';
import NotificationCenter from '../components/NotificationCenter';
import '../styles/Board.css';

const ADMIN_NOTIFICATION_ACTIONS = new Set(['card_created', 'attachment_uploaded']);
const NOTIFICATION_DURATION_MS = 10000;
const BOARD_NOTIFICATION_POLL_MS = 5000;

function Board({ user, onLogout }) {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [boardMembers, setBoardMembers] = useState([]);
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const seenActivityIdsRef = useRef(new Set());
  const notificationsInitializedRef = useRef(false);
  const notificationTimeoutsRef = useRef(new Map());

  const WORKFLOW_ORDER = {
    assigned: 1,
    working: 2,
    done: 3,
    'on hold': 4,
    revision: 5,
    finished: 6,
  };

  const sortedLists = [...(board?.lists || [])].sort((a, b) => {
    const aHasPosition = Number.isInteger(a.position);
    const bHasPosition = Number.isInteger(b.position);

    if (aHasPosition || bHasPosition) {
      const aPosition = aHasPosition ? a.position : 999;
      const bPosition = bHasPosition ? b.position : 999;

      if (aPosition !== bPosition) {
        return aPosition - bPosition;
      }
    }

    const aRank = WORKFLOW_ORDER[(a.title || '').toLowerCase()] ?? 99;
    const bRank = WORKFLOW_ORDER[(b.title || '').toLowerCase()] ?? 99;

    if (aRank !== bRank) {
      return aRank - bRank;
    }

    return a.id - b.id;
  });

  useEffect(() => {
    seenActivityIdsRef.current = new Set();
    notificationsInitializedRef.current = false;
    notificationTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    notificationTimeoutsRef.current.clear();
    setNotifications([]);

    fetchBoard();
    fetchBoardMembers();
  }, [boardId, user?.id]);

  useEffect(() => () => {
    notificationTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    notificationTimeoutsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!boardId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      fetchBoard({ silent: true });
    }, BOARD_NOTIFICATION_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [boardId]);

  useEffect(() => {
    const existingCardIds = new Set(
      (board?.lists || []).flatMap((list) => (list.cards || []).map((card) => card.id))
    );

    setSelectedCardIds((prev) => prev.filter((id) => existingCardIds.has(id)));
  }, [board]);

  const dismissNotification = (notificationId) => {
    const timeoutId = notificationTimeoutsRef.current.get(notificationId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      notificationTimeoutsRef.current.delete(notificationId);
    }

    setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId));
  };

  const queueNotification = (title, message) => {
    const notificationId = `board-notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

  const processBoardNotifications = (boardData) => {
    const activityEntries = (boardData?.lists || []).flatMap((list) =>
      (list.cards || []).flatMap((card) =>
        (card.activity || [])
          .filter(
            (entry) => ADMIN_NOTIFICATION_ACTIONS.has(entry.action_type) && entry.role === 'admin'
          )
          .map((entry) => ({
            id: String(entry.id),
            actorId: entry.user_id,
            actorName: entry.username || 'Admin',
            actionType: entry.action_type,
            boardTitle: boardData.title,
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

  const fetchBoard = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/boards/${boardId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const boardData = response.data;
      const cards = (boardData?.lists || []).flatMap((list) => list.cards || []);

      if (cards.length > 0) {
        const detailResults = await Promise.allSettled(
          cards.map((card) =>
            axios.get(`/api/cards/${card.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          )
        );

        const detailsByCardId = new Map();
        detailResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value?.data?.id) {
            detailsByCardId.set(result.value.data.id, result.value.data);
          }
        });

        boardData.lists = (boardData.lists || []).map((list) => ({
          ...list,
          cards: (list.cards || []).map((card) => {
            const details = detailsByCardId.get(card.id);
            if (!details) {
              return card;
            }

            const memberUsernames = (details.members || [])
              .map((member) => member.username || member.email)
              .filter(Boolean);

            return {
              ...card,
              labels: details.labels || card.labels || [],
              members: details.members || card.members || [],
              attachments: details.attachments || card.attachments || [],
              activity: details.activity || card.activity || [],
              memberUsernames: memberUsernames.length
                ? memberUsernames
                : (card.memberUsernames || []),
              dates: details.dates || card.dates || null,
              due_date: details.dates?.due_date || card.due_date || null,
              due_time: details.dates?.due_time || card.due_time || null,
            };
          })
        }));
      }

      processBoardNotifications(boardData);
      setBoard(boardData);
      setError('');
    } catch (err) {
      if (!silent) {
        setError('Failed to load board');
      }
      console.error(err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const fetchBoardMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/boards/${boardId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBoardMembers(response.data);
    } catch (err) {
      console.error('Failed to load board members', err);
    }
  };

  const handleCardUpdate = (updatedCard) => {
    if (!updatedCard?.id) {
      fetchBoard();
      return;
    }

    const memberUsernames = (updatedCard.members || [])
      .map((member) => member.username || member.email)
      .filter(Boolean);

    const normalizedUpdatedCard = {
      ...updatedCard,
      attachments: updatedCard.attachments || [],
      labels: updatedCard.labels || [],
      members: updatedCard.members || [],
      activity: updatedCard.activity || [],
      memberUsernames,
      dates: updatedCard.dates || null,
      due_date: updatedCard.dates?.due_date || updatedCard.due_date || null,
      due_time: updatedCard.dates?.due_time || updatedCard.due_time || null,
    };

    setBoard((prevBoard) => {
      if (!prevBoard) {
        return prevBoard;
      }

      return {
        ...prevBoard,
        lists: (prevBoard.lists || []).map((list) => ({
          ...list,
          cards: (list.cards || []).map((card) => (
            card.id === normalizedUpdatedCard.id
              ? { ...card, ...normalizedUpdatedCard }
              : card
          )),
        })),
      };
    });

    setSelectedCard((prevCard) => (
      prevCard?.id === normalizedUpdatedCard.id
        ? { ...prevCard, ...normalizedUpdatedCard }
        : prevCard
    ));
  };

  const getDefaultListId = () => {
    if (!board?.lists?.length) return null;

    const assignedList = board.lists.find(
      (list) => list.title?.toLowerCase() === 'assigned'
    );

    return assignedList?.id || board.lists[0].id;
  };

  const handleCreateCard = async () => {
    const defaultListId = getDefaultListId();
    if (!defaultListId) {
      setError('No list found to create card');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const createResponse = await axios.post(
        '/api/cards',
        {
          listId: defaultListId,
          title: 'Untitled card',
          description: ''
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const createdCardId = createResponse.data?.cardId;
      if (!createdCardId) {
        await fetchBoard();
        return;
      }

      const cardResponse = await axios.get(`/api/cards/${createdCardId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSelectedCard({
        ...cardResponse.data,
        attachments: cardResponse.data.attachments || [],
        comments: cardResponse.data.comments || [],
        activity: cardResponse.data.activity || [],
        __startInTitleEdit: true,
      });

      queueNotification('Card Created', 'Your new card is ready to edit.');
      await fetchBoard();
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create card');
    }
  };

  const handleCardClick = async (card) => {
    await fetchBoardMembers();
    setSelectedCard(card);
  };

  const toggleCardSelection = (cardId) => {
    setSelectedCardIds((prev) => (
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    ));
  };

  const handleDeleteCard = async (cardId) => {
    if (!window.confirm('Are you sure you want to delete this card?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/cards/${cardId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedCardIds((prev) => prev.filter((id) => id !== cardId));
      fetchBoard();
      setSelectedCard(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete card');
    }
  };

  const handleBulkDeleteCards = async () => {
    if (!selectedCardIds.length) return;

    if (!window.confirm(`Delete ${selectedCardIds.length} selected card(s)?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const idsToDelete = [...selectedCardIds];
      let failedCount = 0;

      for (const cardId of idsToDelete) {
        try {
          await axios.delete(`/api/cards/${cardId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch {
          failedCount += 1;
        }
      }

      setSelectedCardIds([]);

      if (selectedCard && idsToDelete.includes(selectedCard.id)) {
        setSelectedCard(null);
      }

      await fetchBoard();

      if (failedCount > 0) {
        setError(`Deleted ${idsToDelete.length - failedCount} card(s). ${failedCount} failed.`);
      } else {
        setError('');
      }
    } catch (err) {
      setError('Failed to delete selected cards');
    }
  };

  const handleListColumnDragStart = (listId, event) => {
    if (user?.role !== 'admin') return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(listId));
  };

  const handleListColumnDrop = async (targetListId, event) => {
    event.preventDefault();
    if (user?.role !== 'admin') return;

    const sourceListId = Number(event.dataTransfer.getData('text/plain'));
    if (!sourceListId || sourceListId === targetListId) return;

    const sourceIndex = sortedLists.findIndex((list) => Number(list.id) === sourceListId);
    const targetIndex = sortedLists.findIndex((list) => Number(list.id) === targetListId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const reorderedLists = Array.from(sortedLists);
    const [movedList] = reorderedLists.splice(sourceIndex, 1);
    reorderedLists.splice(targetIndex, 0, movedList);

    setBoard((prevBoard) => ({
      ...prevBoard,
      lists: reorderedLists.map((list, index) => ({ ...list, position: index })),
    }));

    try {
      const token = localStorage.getItem('token');
      await Promise.all(
        reorderedLists.map((list, index) =>
          axios.put(
            `/api/lists/${list.id}`,
            { position: index },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        )
      );
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to move list');
      fetchBoard();
    }
  };

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId, type } = result;

    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    if (type === 'LIST') {
      if (user?.role !== 'admin') return;

      const reorderedLists = Array.from(sortedLists);
      const [movedList] = reorderedLists.splice(source.index, 1);
      reorderedLists.splice(destination.index, 0, movedList);

      setBoard((prevBoard) => ({
        ...prevBoard,
        lists: reorderedLists.map((list, index) => ({ ...list, position: index })),
      }));

      try {
        const token = localStorage.getItem('token');
        await Promise.all(
          reorderedLists.map((list, index) =>
            axios.put(
              `/api/lists/${list.id}`,
              { position: index },
              { headers: { Authorization: `Bearer ${token}` } }
            )
          )
        );
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to move list');
        fetchBoard();
      }
      return;
    }

    if (type !== 'CARD') {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const cardId = parseInt(draggableId);
      const targetListId = parseInt(destination.droppableId);

      setBoard((prevBoard) => {
        if (!prevBoard) return prevBoard;

        const nextLists = (prevBoard.lists || []).map((list) => ({
          ...list,
          cards: [...(list.cards || [])],
        }));
        const sourceList = nextLists.find((list) => String(list.id) === source.droppableId);
        const targetList = nextLists.find((list) => String(list.id) === destination.droppableId);
        if (!sourceList || !targetList) return prevBoard;

        const [movedCard] = sourceList.cards.splice(source.index, 1);
        if (!movedCard) return prevBoard;

        targetList.cards.splice(destination.index, 0, {
          ...movedCard,
          list_id: targetListId,
          position: destination.index,
        });

        return {
          ...prevBoard,
          lists: nextLists.map((list) => ({
            ...list,
            cards: (list.cards || []).map((card, index) => ({ ...card, position: index })),
          })),
        };
      });

      await axios.put(
        `/api/cards/${cardId}/move`,
        { list_id: targetListId, position: destination.index },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      fetchBoard();
    } catch (err) {
      setError('Failed to move card');
      fetchBoard();
    }
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };


  if (loading) {
    return <div className="loading">Loading board...</div>;
  }

  if (!board) {
    return <div className="error-message">Board not found</div>;
  }

  return (
    <div className="board-page">
      <NotificationCenter notifications={notifications} onDismiss={dismissNotification} />
      <header className="board-header">
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            ← Back to Boards
          </button>
          <h1>{board.title}</h1>
          <div className="user-info">
            <span>{user?.username}</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <main className="board-content">
        {user?.role === 'admin' && (
          <div className="board-card-actions">
            <button
              className="btn"
              onClick={handleCreateCard}
            >
              + Add Card
            </button>
            {selectedCardIds.length > 0 && (
              <button
                className="btn btn-danger bulk-delete-btn"
                onClick={handleBulkDeleteCards}
              >
                Delete Selected ({selectedCardIds.length})
              </button>
            )}
          </div>
        )}

        {user?.role !== 'admin' && (
          <div className="card-creation-disabled">
            <p>Only admins can create cards</p>
          </div>
        )}

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="lists-container">
            {sortedLists.map((list) => (
              <Droppable key={list.id} droppableId={String(list.id)} type="CARD">
                {(provided, snapshot) => (
                  <div
                    className={`list ${snapshot.isDraggingOver ? ' dragging-over' : ''}`}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    <h3
                      className="list-title"
                      draggable={user?.role === 'admin'}
                      onDragStart={(event) => handleListColumnDragStart(list.id, event)}
                      onDragOver={(event) => {
                        if (user?.role === 'admin') event.preventDefault();
                      }}
                      onDrop={(event) => handleListColumnDrop(list.id, event)}
                    >
                      {list.title}
                    </h3>
                    <div className="cards-container">
                      {list.cards?.map((card, index) => (
                        <Draggable key={card.id} draggableId={String(card.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={snapshot.isDragging ? 'dragging' : ''}
                            >
                              <Card
                                card={card}
                                onClick={() => handleCardClick(card)}
                                onDelete={() => handleDeleteCard(card.id)}
                                canDelete={user?.role === 'admin'}
                                showSelectControl={user?.role === 'admin'}
                                isSelected={selectedCardIds.includes(card.id)}
                                onToggleSelect={() => toggleCardSelection(card.id)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </main>

      {selectedCard && (
        <CardModal
          card={selectedCard}
          user={user}
          boardMembers={boardMembers}
          onNotify={queueNotification}
          onClose={() => setSelectedCard(null)}
          onCardUpdate={handleCardUpdate}
          onCardDelete={() => {
            handleDeleteCard(selectedCard.id);
          }}
          canDelete={user?.role === 'admin' || selectedCard.created_by_id === user?.id}
          startInTitleEdit={Boolean(selectedCard?.__startInTitleEdit)}
        />
      )}
    </div>
  );
}

export default Board;
