import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

const MOCK_CONVERSATIONS_KEY = "nutripro-private-conversations";
const MOCK_MESSAGES_KEY = "nutripro-private-messages";

function createMockId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function readLocalStorage(key, fallback = []) {
  if (typeof window === "undefined") return fallback;

  try {
    return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeLocalStorage(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeUser(row = {}) {
  return {
    id: row.id ?? row.user_id ?? row.userId ?? "",
    name: row.name ?? row.full_name ?? row.fullName ?? "",
    username: row.username ?? "",
    email: row.email ?? "",
    role: row.role ?? row.roleKey ?? "",
    status: row.status ?? row.statusKey ?? "",
  };
}

function displayNameForUser(user = {}) {
  return user.name || user.username || user.email || "User";
}

function normalizeConversation(row = {}, currentUserId = "") {
  const participants = (row.participants ?? row.private_conversation_participants ?? [])
    .map((participant) => ({
      id: participant.id,
      userId: participant.user_id ?? participant.userId ?? participant.user?.id ?? "",
      role: participant.role ?? participant.user?.role ?? "",
      lastReadAt: participant.last_read_at ?? participant.lastReadAt ?? "",
      user: normalizeUser(participant.user ?? participant.users ?? participant),
    }));
  const messages = (row.messages ?? row.private_messages ?? []).map(normalizeMessage);
  const otherParticipants = participants.filter((participant) => String(participant.userId) !== String(currentUserId));
  const latestMessage = messages[messages.length - 1] ?? row.latestMessage ?? null;

  return {
    id: row.id,
    subject: row.subject ?? "",
    status: row.status ?? "open",
    requestStatus: row.request_status ?? row.requestStatus ?? "none",
    requestedBy: row.requested_by ?? row.requestedBy ?? "",
    requestedTo: row.requested_to ?? row.requestedTo ?? "",
    acceptedAt: row.accepted_at ?? row.acceptedAt ?? "",
    declinedAt: row.declined_at ?? row.declinedAt ?? "",
    createdBy: row.created_by ?? row.createdBy ?? "",
    createdAt: row.created_at ?? row.createdAt ?? "",
    updatedAt: row.updated_at ?? row.updatedAt ?? "",
    participants,
    otherParticipants,
    participantNames: otherParticipants.map((participant) => displayNameForUser(participant.user)).join(", "),
    latestMessage,
  };
}

function normalizeMessage(row = {}) {
  return {
    id: row.id,
    conversationId: row.conversation_id ?? row.conversationId ?? "",
    senderId: row.sender_id ?? row.senderId ?? "",
    body: row.body ?? "",
    createdAt: row.created_at ?? row.createdAt ?? "",
    deletedAt: row.deleted_at ?? row.deletedAt ?? "",
    sender: normalizeUser(row.sender ?? row.users ?? {}),
  };
}

function normalizeRecipient(row = {}) {
  const user = normalizeUser(row.user ?? row);
  return {
    ...user,
    group: row.group ?? row.recipient_group ?? row.recipientGroup ?? "",
    sharedCourseTitle: row.shared_course_title ?? row.sharedCourseTitle ?? "",
  };
}

export async function getPrivateMessageRecipients(currentUser) {
  const role = `${currentUser?.roleKey ?? currentUser?.role ?? ""}`.toLowerCase();

  if (!isSupabaseConfigured || !supabase) {
    return role === "admin"
      ? []
      : [{ id: "admin-mock", name: "Alex Morgan", role: "admin", status: "active", group: "admins" }];
  }

  const { data, error } = await supabase.rpc("get_private_message_recipients");

  if (error) {
    console.error("Loading private message recipients failed:", error);
    throw error;
  }

  return (data ?? []).map(normalizeRecipient);
}

export async function getPrivateConversations(currentUser) {
  const currentUserId = currentUser?.id ?? "";

  if (!isSupabaseConfigured || !supabase) {
    return readLocalStorage(MOCK_CONVERSATIONS_KEY).map((conversation) =>
      normalizeConversation(conversation, currentUserId),
    );
  }

  const { data, error } = await supabase
    .from("private_conversations")
    .select(`
      *,
      participants:private_conversation_participants(
        id,
        user_id,
        role,
        last_read_at,
        user:users(id, name, username, email, role, status)
      ),
      messages:private_messages(
        id,
        conversation_id,
        sender_id,
        body,
        created_at,
        deleted_at,
        sender:users(id, name, username, role)
      )
    `)
    .order("updated_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Loading private conversations failed:", error);
    throw error;
  }

  return (data ?? []).map((conversation) => normalizeConversation(conversation, currentUserId));
}

export async function getPrivateMessages(conversationId) {
  if (!isSupabaseConfigured || !supabase) {
    return readLocalStorage(MOCK_MESSAGES_KEY)
      .filter((message) => String(message.conversation_id) === String(conversationId))
      .map(normalizeMessage);
  }

  const { data, error } = await supabase
    .from("private_messages")
    .select("id, conversation_id, sender_id, body, created_at, deleted_at, sender:users(id, name, username, role)")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Loading private messages failed:", error);
    throw error;
  }

  return (data ?? []).map(normalizeMessage);
}

export async function createPrivateConversation({ recipientId, subject, body }, currentUser) {
  const now = new Date().toISOString();

  if (!isSupabaseConfigured || !supabase) {
    const conversationId = createMockId("conversation");
    const conversation = {
      id: conversationId,
      subject,
      status: "open",
      request_status: "none",
      created_by: currentUser?.id ?? "",
      created_at: now,
      updated_at: now,
      participants: [
        { user_id: currentUser?.id ?? "", user: currentUser },
        { user_id: recipientId, user: { id: recipientId, name: "Recipient" } },
      ],
    };
    const message = {
      id: createMockId("message"),
      conversation_id: conversationId,
      sender_id: currentUser?.id ?? "",
      body,
      created_at: now,
      sender: currentUser,
    };
    writeLocalStorage(MOCK_CONVERSATIONS_KEY, [conversation, ...readLocalStorage(MOCK_CONVERSATIONS_KEY)]);
    writeLocalStorage(MOCK_MESSAGES_KEY, [...readLocalStorage(MOCK_MESSAGES_KEY), message]);
    return { conversationId, requestStatus: "none" };
  }

  const { data, error } = await supabase.rpc("create_private_conversation", {
    recipient_user_id: recipientId,
    conversation_subject: subject,
    first_message: body,
  });

  if (error) {
    console.error("Creating private conversation failed:", error);
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;
  return {
    conversationId: result?.conversation_id ?? result?.id ?? data,
    requestStatus: result?.request_status ?? "none",
  };
}

export async function sendPrivateMessage(conversationId, body, currentUser) {
  if (!isSupabaseConfigured || !supabase) {
    const now = new Date().toISOString();
    const message = {
      id: createMockId("message"),
      conversation_id: conversationId,
      sender_id: currentUser?.id ?? "",
      body,
      created_at: now,
      sender: currentUser,
    };
    writeLocalStorage(MOCK_MESSAGES_KEY, [...readLocalStorage(MOCK_MESSAGES_KEY), message]);
    return normalizeMessage(message);
  }

  const { error } = await supabase
    .from("private_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: currentUser?.id,
      body,
    });

  if (error) {
    console.error("Sending private message failed:", error);
    throw error;
  }

  return { id: "sent", conversationId, senderId: currentUser?.id, body };
}

export async function respondToMessageRequest(conversationId, action) {
  if (!isSupabaseConfigured || !supabase) {
    return { conversationId, requestStatus: action === "accept" ? "accepted" : "declined" };
  }

  const { data, error } = await supabase.rpc("respond_private_message_request", {
    target_conversation_id: conversationId,
    response_action: action,
  });

  if (error) {
    console.error("Responding to private message request failed:", error);
    throw error;
  }

  return Array.isArray(data) ? data[0] : data;
}

export async function reportPrivateConversation(conversationId) {
  if (!isSupabaseConfigured || !supabase) {
    return { conversationId, reported: true };
  }

  const { data, error } = await supabase.rpc("report_private_conversation", {
    target_conversation_id: conversationId,
  });

  if (error) {
    console.error("Reporting private conversation failed:", error);
    throw error;
  }

  return data;
}
