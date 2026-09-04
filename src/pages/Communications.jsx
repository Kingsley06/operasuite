import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Camera, SendHorizontal, Send, Settings, Bot, CheckCircle2, Plus, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useHotel } from '../context/HotelContext';
import { useToast } from '../context/ToastContext';
import { Modal, Card, Btn, Badge, Input, Select, Textarea, EmptyState } from '../components/ui';

// lucide-react ships no brand icons — these generic ones stand in per channel.
const CHANNEL_ICON = { whatsapp: MessageCircle, instagram: Camera, messenger: SendHorizontal };
const CHANNEL_LABEL = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' };

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

function ConversationStatusBadge({ status }) {
  const config = {
    open: { color: 'blue', label: 'Open' },
    resolved: { color: 'green', label: 'Resolved' },
    needs_attention: { color: 'red', label: 'Needs You' },
  };
  const c = config[status] || { color: 'gray', label: status };
  return <Badge color={c.color}>{c.label}</Badge>;
}

function ConversationListItem({ conversation, active, onClick }) {
  const Icon = CHANNEL_ICON[conversation.channelType] || MessageCircle;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors
        ${active ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
    >
      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-500">
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">
            {conversation.contactName || 'Unknown guest'}
          </span>
          <span className="text-xs text-gray-400 shrink-0">{formatTime(conversation.lastMessageAt)}</span>
        </div>
        <p className="text-xs text-gray-500 truncate mt-0.5">{conversation.lastMessagePreview || '—'}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <ConversationStatusBadge status={conversation.status} />
          {conversation.aiHandled && <Badge color="purple">AI</Badge>}
          {conversation.unreadCount > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ message }) {
  const isGuest = message.sender === 'guest';
  const bubbleClasses = isGuest
    ? 'bg-gray-100 text-gray-800'
    : 'bg-emerald-600 text-white';
  const timeClasses = isGuest ? 'text-gray-400' : 'text-emerald-100';

  return (
    <div className={`flex ${isGuest ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${bubbleClasses}`}>
        {!isGuest && (
          <div className="flex items-center gap-1 mb-1 text-xs text-emerald-100">
            {message.sender === 'ai' ? <Bot size={12} /> : <CheckCircle2 size={12} />}
            {message.sender === 'ai' ? 'AI Receptionist' : 'Staff'}
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
        <div className={`text-[10px] mt-1 ${timeClasses}`}>{formatTime(message.createdAt)}</div>
      </div>
    </div>
  );
}

function AddChannelForm({ onSaved }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: 'whatsapp', displayName: '', externalAccountId: '', accessToken: '', appSecret: '', verifyToken: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('save-channel-credential', { body: form });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast('Channel connected', 'success');
      setForm({ type: 'whatsapp', displayName: '', externalAccountId: '', accessToken: '', appSecret: '', verifyToken: '' });
      onSaved();
    } catch (err) {
      toast(err.message || 'Failed to connect channel', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border border-dashed border-gray-200 rounded-xl">
      <Select label="Platform" value={form.type} onChange={e => set('type', e.target.value)}>
        <option value="whatsapp">WhatsApp</option>
        <option value="instagram">Instagram</option>
        <option value="messenger">Messenger</option>
      </Select>
      <Input label="Display name" value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="e.g. Front Desk WhatsApp" />
      <Input label="Account / phone number ID" value={form.externalAccountId} onChange={e => set('externalAccountId', e.target.value)} required />
      <Input label="Access token" type="password" value={form.accessToken} onChange={e => set('accessToken', e.target.value)} required />
      <Input label="App secret" type="password" value={form.appSecret} onChange={e => set('appSecret', e.target.value)} required />
      <Input label="Webhook verify token" value={form.verifyToken} onChange={e => set('verifyToken', e.target.value)} required placeholder="Choose any string — you'll enter this in Meta too" />
      <Btn type="submit" disabled={saving} className="w-full justify-center">{saving ? 'Connecting…' : 'Connect channel'}</Btn>
    </form>
  );
}

function ChannelSettingsModal({ channels, isOwner, onClose, onToggleAutonomy, onChannelSaved }) {
  return (
    <Modal title="Communication channels" onClose={onClose} size="lg">
      <div className="p-6 space-y-6">
        <div className="space-y-3">
          {channels.length === 0 && <p className="text-sm text-gray-500">No channels connected yet.</p>}
          {channels.map(ch => {
            const Icon = CHANNEL_ICON[ch.type] || MessageCircle;
            return (
              <div key={ch.id} className="flex items-center justify-between px-4 py-3 border border-gray-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                    <Icon size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{ch.displayName || CHANNEL_LABEL[ch.type]}</div>
                    <div className="text-xs text-gray-400">{CHANNEL_LABEL[ch.type]}</div>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                  AI auto-reply
                  <input
                    type="checkbox"
                    checked={ch.aiAutonomous}
                    onChange={() => onToggleAutonomy(ch)}
                    className="w-4 h-4 accent-emerald-600"
                  />
                </label>
              </div>
            );
          })}
        </div>

        {isOwner && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><Plus size={16} /> Connect a new channel</h3>
            <AddChannelForm onSaved={onChannelSaved} />
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Communications() {
  const { hotelId, isOwner, isManagement } = useHotel();
  const toast = useToast();
  const [channels, setChannels] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const threadEndRef = useRef(null);

  const canManageChannels = isOwner || isManagement;

  const loadChannels = useCallback(async () => {
    if (!hotelId) return;
    const { data } = await supabase.from('channels').select('*').eq('hotel_id', hotelId).order('created_at');
    setChannels((data ?? []).map(c => ({
      id: c.id, type: c.type, displayName: c.display_name, externalAccountId: c.external_account_id,
      aiAutonomous: c.ai_autonomous, isActive: c.is_active,
    })));
  }, [hotelId]);

  const loadConversations = useCallback(async () => {
    if (!hotelId) return;
    const { data } = await supabase
      .from('conversations')
      .select('*, channels(type)')
      .eq('hotel_id', hotelId)
      .order('last_message_at', { ascending: false, nullsFirst: false });
    setConversations((data ?? []).map(c => ({
      id: c.id, channelId: c.channel_id, channelType: c.channels?.type, guestId: c.guest_id,
      contactName: c.contact_name, status: c.status, aiHandled: c.ai_handled,
      lastMessageAt: c.last_message_at, lastMessagePreview: c.last_message_preview, unreadCount: c.unread_count,
    })));
    setLoading(false);
  }, [hotelId]);

  useEffect(() => { loadChannels(); loadConversations(); }, [loadChannels, loadConversations]);

  // selectedId changes frequently; keep a ref so the realtime callback (subscribed once) reads the latest value
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // Realtime: keep the inbox live as guests/AI/staff send messages
  useEffect(() => {
    if (!hotelId) return;
    const ch = supabase
      .channel(`hotel:${hotelId}:comms`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `hotel_id=eq.${hotelId}` }, () => loadConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `hotel_id=eq.${hotelId}` }, (payload) => {
        setMessages(prev => (payload.new.conversation_id === selectedIdRef.current
          ? [...prev, mapMessage(payload.new)]
          : prev));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hotelId, loadConversations]);

  const openConversation = async (id) => {
    setSelectedId(id);
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', id).order('created_at');
    setMessages((data ?? []).map(mapMessage));
    await supabase.from('conversations').update({ unread_count: 0 }).eq('id', id);
    setConversations(prev => prev.map(c => (c.id === id ? { ...c, unreadCount: 0 } : c)));
  };

  useEffect(() => { threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!composerText.trim() || !selectedId) return;
    setSending(true);
    const text = composerText.trim();
    try {
      const { data, error } = await supabase.functions.invoke('send-manual-message', {
        body: { conversationId: selectedId, text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setComposerText('');
      setConversations(prev => prev.map(c => (c.id === selectedId ? { ...c, aiHandled: false, status: 'open' } : c)));
    } catch (err) {
      toast(err.message || 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    await supabase.from('conversations').update({ status: 'resolved' }).eq('id', selectedId);
    setConversations(prev => prev.map(c => (c.id === selectedId ? { ...c, status: 'resolved' } : c)));
  };

  const handleHandBackToAI = async () => {
    await supabase.from('conversations').update({ ai_handled: true, status: 'open' }).eq('id', selectedId);
    setConversations(prev => prev.map(c => (c.id === selectedId ? { ...c, aiHandled: true, status: 'open' } : c)));
  };

  const handleToggleAutonomy = async (channel) => {
    const { error } = await supabase.from('channels').update({ ai_autonomous: !channel.aiAutonomous }).eq('id', channel.id);
    if (error) { toast(error.message, 'error'); return; }
    setChannels(prev => prev.map(c => (c.id === channel.id ? { ...c, aiAutonomous: !c.aiAutonomous } : c)));
  };

  const selectedConversation = conversations.find(c => c.id === selectedId);
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount > 0 ? 1 : 0), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Loading conversations…</p></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalUnread > 0 ? `${totalUnread} conversation${totalUnread === 1 ? '' : 's'} with new activity` : 'All caught up'}
          </p>
        </div>
        {canManageChannels && (
          <Btn variant="secondary" onClick={() => setSettingsOpen(true)}>
            <Settings size={16} /> Channels
          </Btn>
        )}
      </div>

      <Card className="flex h-[calc(100vh-220px)] min-h-[420px] overflow-hidden">
        {/* Conversation list */}
        <div className={`w-full sm:w-80 border-r border-gray-100 flex flex-col shrink-0 ${selectedId ? 'hidden sm:flex' : 'flex'}`}>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No conversations yet"
                description={channels.length === 0
                  ? 'Connect a WhatsApp, Instagram, or Messenger channel to start receiving guest messages here.'
                  : 'Guest messages across all channels will show up here.'}
                action={canManageChannels && channels.length === 0
                  ? <Btn onClick={() => setSettingsOpen(true)}><Plus size={16} /> Connect a channel</Btn>
                  : null}
              />
            ) : (
              conversations.map(c => (
                <ConversationListItem key={c.id} conversation={c} active={c.id === selectedId} onClick={() => openConversation(c.id)} />
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        <div className={`flex-1 flex flex-col min-w-0 ${selectedId ? 'flex' : 'hidden sm:flex'}`}>
          {selectedConversation ? (
            <>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                  <button className="sm:hidden p-1 -ml-1 text-gray-400" onClick={() => setSelectedId(null)}>
                    <ArrowLeft size={18} />
                  </button>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{selectedConversation.contactName || 'Unknown guest'}</div>
                    <div className="text-xs text-gray-400">{CHANNEL_LABEL[selectedConversation.channelType]}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedConversation.aiHandled && <Badge color="purple">AI handling</Badge>}
                  <ConversationStatusBadge status={selectedConversation.status} />
                  {!selectedConversation.aiHandled && (
                    <Btn size="sm" variant="secondary" onClick={handleHandBackToAI}>Hand back to AI</Btn>
                  )}
                  {selectedConversation.status !== 'resolved' && (
                    <Btn size="sm" variant="secondary" onClick={handleResolve}>Resolve</Btn>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/50">
                {messages.map(m => <MessageBubble key={m.id} message={m} />)}
                <div ref={threadEndRef} />
              </div>

              <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex items-end gap-2">
                <div className="flex-1">
                  <Textarea
                    value={composerText}
                    onChange={e => setComposerText(e.target.value)}
                    placeholder="Type a reply — sending takes this conversation off the AI"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                  />
                </div>
                <Btn type="submit" disabled={sending || !composerText.trim()}>
                  <Send size={16} />
                </Btn>
              </form>
            </>
          ) : (
            <EmptyState icon={MessageCircle} title="Select a conversation" description="Pick a conversation from the list to view the thread." />
          )}
        </div>
      </Card>

      {settingsOpen && (
        <ChannelSettingsModal
          channels={channels}
          isOwner={isOwner}
          onClose={() => setSettingsOpen(false)}
          onToggleAutonomy={handleToggleAutonomy}
          onChannelSaved={loadChannels}
        />
      )}
    </div>
  );
}

function mapMessage(row) {
  return { id: row.id, direction: row.direction, sender: row.sender, body: row.body, createdAt: row.created_at };
}
