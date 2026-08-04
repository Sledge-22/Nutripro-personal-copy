import React, { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { sanitizeErrorDetails } from "../utils/errorDisplay.js";
import {
  createPrivateConversation,
  getPrivateConversations,
  getPrivateMessageRecipients,
  getPrivateMessages,
  reportPrivateConversation,
  respondToMessageRequest,
  searchPrivateMessageUsersForAdmin,
  sendPrivateMessage,
} from "../services/privateMessagingService.js";

function getMessagesCopy(language) {
  if (language === "es") {
    return {
      messages: "Mensajes",
      inbox: "Bandeja de entrada",
      requests: "Solicitudes de mensajes",
      sentRequests: "Solicitudes enviadas",
      newMessage: "Nuevo mensaje",
      send: "Enviar",
      reply: "Responder",
      subject: "Asunto",
      recipient: "Destinatario",
      selectRecipient: "Seleccionar destinatario",
      searchRecipient: "Buscar por nombre, usuario o email",
      selectedRecipient: "Destinatario seleccionado",
      changeRecipient: "Cambiar",
      selectRecipientRequired: "SeleccionÃ¡ un destinatario.",
      noMatchingUsers: "No se encontraron usuarios.",
      searching: "Buscando...",
      admins: "Administradores",
      classmates: "Compañeros",
      users: "Usuarios",
      noMessages: "Todavía no hay mensajes.",
      startConversation: "Iniciar conversación.",
      messageSent: "Mensaje enviado.",
      messageRequestSent: "Solicitud de mensaje enviada. Podrás continuar la conversación si la aceptan.",
      messageFailed: "No se pudo enviar el mensaje.",
      noAccess: "No tenés acceso a esta conversación.",
      classmateRule: "Solo podés enviar mensajes a compañeros de tus cursos inscritos.",
      noClassmates: "Todavía no hay compañeros disponibles.",
      accept: "Aceptar",
      decline: "Rechazar",
      requestAccepted: "Solicitud de mensaje aceptada.",
      requestDeclined: "Solicitud de mensaje rechazada.",
      requestPending: "Esta solicitud de mensaje está pendiente.",
      continueIfAccepted: "Podrás continuar la conversación si la aceptan.",
      adminDirect: "Los mensajes de administradores llegan directamente a tu bandeja.",
      instructorDirect: "Por ahora, los instructores solo pueden enviar mensajes a administradores.",
      report: "Reportar conversación",
      reported: "Conversación reportada.",
      loadFailed: "No se pudieron cargar los mensajes.",
      recipientLoadFailed: "No se pudieron cargar los destinatarios.",
      responseFailed: "No se pudo actualizar la solicitud.",
      reportFailed: "No se pudo reportar la conversación.",
      activeOnly: "Tu cuenta debe estar activa para enviar mensajes.",
      messageClassmate: "Enviar mensaje a un compañero",
      noConversationSelected: "Seleccioná una conversación.",
      body: "Mensaje",
      firstMessage: "Primer mensaje",
      pending: "Pendiente",
      accepted: "Aceptada",
      declined: "Rechazada",
      open: "Abierta",
    };
  }

  return {
    messages: "Messages",
    inbox: "Inbox",
    requests: "Message Requests",
    sentRequests: "Sent Requests",
    newMessage: "New message",
    send: "Send",
    reply: "Reply",
    subject: "Subject",
    recipient: "Recipient",
    selectRecipient: "Select recipient",
    searchRecipient: "Search by name, username, or email",
    selectedRecipient: "Selected recipient",
    changeRecipient: "Change",
    selectRecipientRequired: "Please select a recipient.",
    noMatchingUsers: "No matching users found.",
    searching: "Searching...",
    admins: "Admins",
    classmates: "Classmates",
    users: "Users",
    noMessages: "No messages yet.",
    startConversation: "Start a conversation.",
    messageSent: "Message sent.",
    messageRequestSent: "Message request sent. You can continue the conversation if they accept.",
    messageFailed: "Message could not be sent.",
    noAccess: "You do not have access to this conversation.",
    classmateRule: "You can only message classmates from your enrolled courses.",
    noClassmates: "No classmates available yet.",
    accept: "Accept",
    decline: "Decline",
    requestAccepted: "Message request accepted.",
    requestDeclined: "Message request declined.",
    requestPending: "This message request is pending.",
    continueIfAccepted: "You can continue the conversation if they accept.",
    adminDirect: "Admin messages go directly to your inbox.",
    instructorDirect: "For now, instructors can only message admins.",
    report: "Report conversation",
    reported: "Conversation reported.",
    loadFailed: "Messages could not be loaded.",
    recipientLoadFailed: "Recipients could not be loaded.",
    responseFailed: "Message request could not be updated.",
    reportFailed: "Conversation could not be reported.",
    activeOnly: "Your account must be active to send messages.",
    messageClassmate: "Message classmate",
    noConversationSelected: "Select a conversation.",
    body: "Message",
    firstMessage: "First message",
    pending: "Pending",
    accepted: "Accepted",
    declined: "Declined",
    open: "Open",
  };
}

function formatDisplayDate(value, language = "es") {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString(language === "es" ? "es-ES" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function displayNameForUser(user = {}) {
  return user.name || user.username || user.email || "User";
}

function displayRoleForUser(user = {}, language = "es") {
  const role = `${user.roleKey ?? user.role ?? ""}`.toLowerCase();
  if (role === "admin") return language === "es" ? "Administrador" : "Admin";
  if (role === "student") return language === "es" ? "Estudiante" : "Student";
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : "";
}

function getConversationTitle(conversation, copy) {
  return conversation?.participantNames || conversation?.subject || copy.noConversationSelected;
}

function isAdmin(user) {
  return `${user?.roleKey ?? user?.role ?? ""}`.toLowerCase() === "admin";
}

function isInstructor(user) {
  return `${user?.roleKey ?? user?.role ?? ""}`.toLowerCase() === "instructor";
}

function isActive(user) {
  const status = `${user?.statusKey ?? user?.status ?? ""}`.toLowerCase();
  return !status || status === "active";
}

function requestStatusLabel(status, copy) {
  if (status === "pending") return copy.pending;
  if (status === "accepted") return copy.accepted;
  if (status === "declined") return copy.declined;
  return copy.open;
}

export function PrivateMessagesPage({ currentUser }) {
  const { language } = useLanguage();
  const copy = getMessagesCopy(language);
  const [tab, setTab] = useState("inbox");
  const [composeOpen, setComposeOpen] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [notice, setNotice] = useState("");
  const [composeDraft, setComposeDraft] = useState({ subject: "", body: "" });
  const [recipientSearchText, setRecipientSearchText] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [recipientSearchResults, setRecipientSearchResults] = useState([]);
  const [recipientSearchOpen, setRecipientSearchOpen] = useState(false);
  const [recipientSearchLoading, setRecipientSearchLoading] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [sending, setSending] = useState(false);

  const currentUserId = currentUser?.id ?? "";
  const currentUserIsAdmin = isAdmin(currentUser);
  const currentUserIsInstructor = isInstructor(currentUser);
  const userCanSend = isActive(currentUser);
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const selectedIsPendingRequest =
    selectedConversation?.requestStatus === "pending" &&
    String(selectedConversation?.requestedTo) === String(currentUserId);
  const selectedIsPendingSent =
    selectedConversation?.requestStatus === "pending" &&
    String(selectedConversation?.requestedBy) === String(currentUserId);
  const selectedIsDeclined = selectedConversation?.requestStatus === "declined";
  const replyDisabled =
    !selectedConversation ||
    !userCanSend ||
    selectedIsDeclined ||
    (!currentUserIsAdmin && selectedConversation.requestStatus === "pending");

  const groupedRecipients = useMemo(() => {
    const groups = {
      admins: [],
      classmates: [],
      users: [],
    };

    recipients.forEach((recipient) => {
      const group = recipient.group || (recipient.role === "admin" ? "admins" : currentUserIsAdmin ? "users" : "classmates");
      if (!groups[group]) groups[group] = [];
      groups[group].push(recipient);
    });

    return groups;
  }, [currentUserIsAdmin, recipients]);

  const filteredStudentRecipients = useMemo(() => {
    if (currentUserIsAdmin) return [];

    const term = recipientSearchText.trim().toLowerCase();
    const allowedRecipients = recipients.filter((recipient) => String(recipient.id) !== String(currentUserId));

    if (!term) return allowedRecipients;

    return allowedRecipients.filter((recipient) =>
      `${recipient.name} ${recipient.username} ${recipient.email} ${recipient.role} ${recipient.sharedCourseTitle}`
        .toLowerCase()
        .includes(term),
    );
  }, [currentUserId, currentUserIsAdmin, recipientSearchText, recipients]);

  const visibleConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      if (tab === "requests") {
        return conversation.requestStatus === "pending" && String(conversation.requestedTo) === String(currentUserId);
      }

      if (tab === "sent") {
        return conversation.requestStatus !== "none" && String(conversation.requestedBy) === String(currentUserId);
      }

      return conversation.requestStatus === "none" || conversation.requestStatus === "accepted";
    });
  }, [conversations, currentUserId, tab]);

  const clearError = () => {
    setError("");
    setErrorDetails("");
  };

  const showError = (fallback, caughtError) => {
    console.error(fallback, caughtError);
    setError(fallback);
    setErrorDetails(sanitizeErrorDetails(caughtError));
  };

  const loadMessagingData = async () => {
    setLoading(true);
    clearError();

    try {
      const [nextConversations, nextRecipients] = await Promise.all([
        getPrivateConversations(currentUser),
        getPrivateMessageRecipients(currentUser),
      ]);
      setConversations(nextConversations);
      setRecipients(nextRecipients);
      setSelectedConversationId((current) =>
        nextConversations.some((conversation) => conversation.id === current)
          ? current
          : nextConversations[0]?.id ?? null,
      );
    } catch (caughtError) {
      showError(copy.loadFailed, caughtError);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedMessages = async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setMessageLoading(true);
    clearError();

    try {
      setMessages(await getPrivateMessages(conversationId));
    } catch (caughtError) {
      showError(copy.noAccess, caughtError);
    } finally {
      setMessageLoading(false);
    }
  };

  useEffect(() => {
    void loadMessagingData();
  }, [currentUserId]);

  useEffect(() => {
    void loadSelectedMessages(selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!currentUserIsAdmin || !composeOpen || selectedRecipient) {
      setRecipientSearchResults([]);
      setRecipientSearchLoading(false);
      return undefined;
    }

    const term = recipientSearchText.trim();
    if (term.length < 2) {
      setRecipientSearchResults([]);
      setRecipientSearchLoading(false);
      return undefined;
    }

    setRecipientSearchLoading(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await searchPrivateMessageUsersForAdmin(term, currentUser);
        setRecipientSearchResults(results);
        setRecipientSearchOpen(true);
      } catch (caughtError) {
        showError(copy.recipientLoadFailed, caughtError);
      } finally {
        setRecipientSearchLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [composeOpen, copy.recipientLoadFailed, currentUser, currentUserIsAdmin, recipientSearchText, selectedRecipient]);

  const handleSelectRecipient = (recipient) => {
    setSelectedRecipient(recipient);
    setRecipientSearchText(displayNameForUser(recipient));
    setRecipientSearchOpen(false);
    setRecipientSearchResults([]);
    clearError();
  };

  const handleClearRecipient = () => {
    setSelectedRecipient(null);
    setRecipientSearchText("");
    setRecipientSearchResults([]);
    setRecipientSearchOpen(false);
  };

  const handleCreateConversation = async (event) => {
    event.preventDefault();
    clearError();
    setNotice("");

    if (!userCanSend) {
      setError(copy.activeOnly);
      return;
    }

    if (!selectedRecipient?.id) {
      setError(copy.selectRecipientRequired);
      return;
    }

    if (!composeDraft.body.trim()) {
      setError(copy.messageFailed);
      return;
    }

    setSending(true);

    try {
      const result = await createPrivateConversation(
        {
          recipientId: selectedRecipient.id,
          subject: composeDraft.subject.trim(),
          body: composeDraft.body.trim(),
        },
        currentUser,
      );
      setComposeDraft({ subject: "", body: "" });
      handleClearRecipient();
      setComposeOpen(false);
      setNotice(result.requestStatus === "pending" ? copy.messageRequestSent : copy.messageSent);
      await loadMessagingData();
      if (result.conversationId) {
        setSelectedConversationId(result.conversationId);
        setTab(result.requestStatus === "pending" ? "sent" : "inbox");
      }
    } catch (caughtError) {
      showError(copy.messageFailed, caughtError);
    } finally {
      setSending(false);
    }
  };

  const handleSendReply = async (event) => {
    event.preventDefault();
    clearError();
    setNotice("");

    if (!selectedConversation || !replyDraft.trim() || replyDisabled) {
      setError(selectedIsPendingSent ? copy.continueIfAccepted : copy.messageFailed);
      return;
    }

    setSending(true);

    try {
      await sendPrivateMessage(selectedConversation.id, replyDraft.trim(), currentUser);
      setReplyDraft("");
      setNotice(copy.messageSent);
      await loadMessagingData();
      await loadSelectedMessages(selectedConversation.id);
    } catch (caughtError) {
      showError(copy.messageFailed, caughtError);
    } finally {
      setSending(false);
    }
  };

  const handleRequestResponse = async (action) => {
    if (!selectedConversation) return;
    clearError();
    setNotice("");
    setSending(true);

    try {
      await respondToMessageRequest(selectedConversation.id, action);
      setNotice(action === "accept" ? copy.requestAccepted : copy.requestDeclined);
      await loadMessagingData();
      setTab(action === "accept" ? "inbox" : "requests");
    } catch (caughtError) {
      showError(copy.responseFailed, caughtError);
    } finally {
      setSending(false);
    }
  };

  const handleReportConversation = async () => {
    if (!selectedConversation) return;
    clearError();
    setNotice("");

    try {
      await reportPrivateConversation(selectedConversation.id);
      setNotice(copy.reported);
    } catch (caughtError) {
      showError(copy.reportFailed, caughtError);
    }
  };

  const renderRecipientOptions = (groupKey, groupLabel) => {
    const groupRecipients = groupedRecipients[groupKey] ?? [];
    if (!groupRecipients.length && groupKey === "classmates") {
      return <small className="field-note">{copy.noClassmates}</small>;
    }
    if (!groupRecipients.length) return null;

    return (
      <optgroup label={groupLabel}>
        {groupRecipients.map((recipient) => (
          <option key={recipient.id} value={recipient.id}>
            {displayNameForUser(recipient)}
            {recipient.sharedCourseTitle ? ` · ${recipient.sharedCourseTitle}` : ""}
          </option>
        ))}
      </optgroup>
    );
  };

  const renderRecipientRow = (recipient) => (
    <button
      type="button"
      key={recipient.id}
      className="recipient-search-option"
      onClick={() => handleSelectRecipient(recipient)}
    >
      <strong>{displayNameForUser(recipient)}</strong>
      <span>
        {recipient.username ? `@${recipient.username} · ` : ""}
        {recipient.email}
        {recipient.email ? " · " : ""}
        {displayRoleForUser(recipient, language)}
      </span>
      {recipient.sharedCourseTitle ? <small>{recipient.sharedCourseTitle}</small> : null}
    </button>
  );

  const renderRecipientPicker = () => {
    const dropdownResults = currentUserIsAdmin ? recipientSearchResults : filteredStudentRecipients;
    const showStudentGroups = !currentUserIsAdmin && !currentUserIsInstructor && !recipientSearchText.trim();
    const hasDropdown = recipientSearchOpen && !selectedRecipient;

    return (
      <label className="recipient-search-field">
        {copy.recipient}
        <div className="recipient-search-shell">
          <input
            value={recipientSearchText}
            onChange={(event) => {
              setRecipientSearchText(event.target.value);
              setSelectedRecipient(null);
              setRecipientSearchOpen(true);
            }}
            onFocus={() => setRecipientSearchOpen(true)}
            placeholder={currentUserIsAdmin ? copy.searchRecipient : copy.selectRecipient}
            autoComplete="off"
          />
          {hasDropdown ? (
            <div className="recipient-search-menu">
              {recipientSearchLoading ? <small className="field-note">{copy.searching}</small> : null}
              {showStudentGroups ? (
                <>
                  {groupedRecipients.admins?.length ? (
                    <div className="recipient-search-group">
                      <span>{copy.admins}</span>
                      {groupedRecipients.admins.map(renderRecipientRow)}
                    </div>
                  ) : null}
                  {groupedRecipients.classmates?.length ? (
                    <div className="recipient-search-group">
                      <span>{copy.classmates}</span>
                      {groupedRecipients.classmates.map(renderRecipientRow)}
                    </div>
                  ) : (
                    <small className="field-note">{copy.noClassmates}</small>
                  )}
                </>
              ) : null}
              {!showStudentGroups && !recipientSearchLoading ? (
                dropdownResults.length ? (
                  dropdownResults.map(renderRecipientRow)
                ) : (
                  <small className="field-note">{copy.noMatchingUsers}</small>
                )
              ) : null}
            </div>
          ) : null}
        </div>
        {selectedRecipient ? (
          <div className="selected-recipient-card">
            <div>
              <small>{copy.selectedRecipient}</small>
              <strong>{displayNameForUser(selectedRecipient)}</strong>
              <span>
                {selectedRecipient.username ? `@${selectedRecipient.username} · ` : ""}
                {selectedRecipient.email}
                {selectedRecipient.email ? " · " : ""}
                {displayRoleForUser(selectedRecipient, language)}
              </span>
            </div>
            <button type="button" className="secondary-btn compact-btn" onClick={handleClearRecipient}>
              {copy.changeRecipient}
            </button>
          </div>
        ) : null}
      </label>
    );
  };

  return (
    <div className="messages-page">
      <section className="section-card messages-compose-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{copy.messages}</span>
            <h2>{copy.messages}</h2>
            <p>{isAdmin(currentUser) ? copy.adminDirect : isInstructor(currentUser) ? copy.instructorDirect : copy.classmateRule}</p>
          </div>
          <button type="button" className="primary-btn" onClick={() => setComposeOpen((current) => !current)}>
            {copy.newMessage}
          </button>
        </div>

        {composeOpen ? (
          <form className="messages-compose-form" onSubmit={(event) => void handleCreateConversation(event)}>
            {renderRecipientPicker()}
            <label>
              {copy.subject}
              <input
                value={composeDraft.subject}
                onChange={(event) => setComposeDraft((current) => ({ ...current, subject: event.target.value }))}
              />
            </label>
            <label className="wide-field">
              {copy.firstMessage}
              <textarea
                rows="4"
                value={composeDraft.body}
                onChange={(event) => setComposeDraft((current) => ({ ...current, body: event.target.value }))}
                required
              />
            </label>
            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={() => setComposeOpen(false)}>
                {language === "es" ? "Cancelar" : "Cancel"}
              </button>
              <button type="submit" className="primary-btn" disabled={sending || !userCanSend || !selectedRecipient?.id}>
                {copy.send}
              </button>
            </div>
          </form>
        ) : null}

        {notice ? <small className="field-note success-text">{notice}</small> : null}
        {error ? <small className="field-note danger-text">{error}</small> : null}
        {errorDetails ? (
          <details className="admin-error-details">
            <summary>{language === "es" ? "Detalles técnicos" : "Technical details"}</summary>
            <pre>{errorDetails}</pre>
          </details>
        ) : null}
      </section>

      <div className="messages-tabs" role="tablist" aria-label={copy.messages}>
        {[
          ["inbox", copy.inbox],
          ["requests", copy.requests],
          ["sent", copy.sentRequests],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="messages-layout">
        <section className="section-card messages-list-card">
          {loading ? <small className="field-note">{language === "es" ? "Cargando..." : "Loading..."}</small> : null}
          {!loading && !visibleConversations.length ? (
            <div className="empty-state-card">
              <p>{copy.noMessages}</p>
              <small>{copy.startConversation}</small>
            </div>
          ) : (
            <div className="messages-conversation-list">
              {visibleConversations.map((conversation) => (
                <button
                  type="button"
                  key={conversation.id}
                  className={`messages-conversation-row ${conversation.id === selectedConversationId ? "active" : ""}`}
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  <strong>{getConversationTitle(conversation, copy)}</strong>
                  <span>{conversation.subject || copy.messages}</span>
                  <small>{conversation.latestMessage?.body || "—"}</small>
                  <em>{requestStatusLabel(conversation.requestStatus, copy)} · {formatDisplayDate(conversation.updatedAt || conversation.createdAt, language)}</em>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="section-card messages-thread-card">
          {selectedConversation ? (
            <>
              <div className="messages-thread-header">
                <div>
                  <span className="eyebrow">{requestStatusLabel(selectedConversation.requestStatus, copy)}</span>
                  <h2>{selectedConversation.subject || getConversationTitle(selectedConversation, copy)}</h2>
                  <p>{getConversationTitle(selectedConversation, copy)}</p>
                </div>
                <button type="button" className="secondary-btn" onClick={() => void handleReportConversation()}>
                  {copy.report}
                </button>
              </div>

              {selectedIsPendingRequest ? (
                <div className="message-request-actions">
                  <small className="field-note">{copy.requestPending}</small>
                  <div className="form-actions">
                    <button type="button" className="primary-btn" onClick={() => void handleRequestResponse("accept")} disabled={sending}>
                      {copy.accept}
                    </button>
                    <button type="button" className="danger-btn" onClick={() => void handleRequestResponse("decline")} disabled={sending}>
                      {copy.decline}
                    </button>
                  </div>
                </div>
              ) : null}

              {selectedIsPendingSent ? <small className="field-note">{copy.continueIfAccepted}</small> : null}
              {selectedIsDeclined ? <small className="field-note danger-text">{copy.requestDeclined}</small> : null}

              <div className="messages-thread">
                {messageLoading ? <small className="field-note">{language === "es" ? "Cargando..." : "Loading..."}</small> : null}
                {!messageLoading && !messages.length ? <small className="field-note">{copy.noMessages}</small> : null}
                {messages.map((message) => {
                  const ownMessage = String(message.senderId) === String(currentUserId);
                  return (
                    <article key={message.id} className={`message-bubble ${ownMessage ? "own" : ""}`}>
                      <strong>{ownMessage ? displayNameForUser(currentUser) : displayNameForUser(message.sender)}</strong>
                      <p>{message.body}</p>
                      <small>{formatDisplayDate(message.createdAt, language)}</small>
                    </article>
                  );
                })}
              </div>

              <form className="messages-reply-form" onSubmit={(event) => void handleSendReply(event)}>
                <label>
                  {copy.reply}
                  <textarea
                    rows="3"
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    disabled={replyDisabled}
                  />
                </label>
                <div className="form-actions">
                  <button type="submit" className="primary-btn" disabled={sending || replyDisabled || !replyDraft.trim()}>
                    {copy.send}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="empty-state-card">
              <p>{copy.noConversationSelected}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
