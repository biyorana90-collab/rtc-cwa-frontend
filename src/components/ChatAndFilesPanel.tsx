import React, { useState, useEffect, useRef, useContext } from 'react';
import { Socket } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import API from '../services/api';
import { Send, Paperclip, FileText, Download, MessageSquare, Image as ImageIcon } from 'lucide-react';

interface ChatAndFilesProps {
  socket: Socket | null;
  roomId: string;
}

const BACKEND_URL = 'https://rtc-cwa-backend-production.up.railway.app';

export const ChatAndFilesPanel: React.FC<ChatAndFilesProps> = ({ socket, roomId }) => {
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [files, setFiles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'files'>('chat');
  const [uploading, setUploading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFiles();

    if (!socket) return;

    socket.on('receive-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    socket.on('file-uploaded', (fileData) => {
      setFiles((prev) => [fileData, ...prev]);
    });

    return () => {
      socket.off('receive-message');
      socket.off('file-uploaded');
    };
  }, [socket, roomId]);

  const fetchFiles = async () => {
    try {
      const res = await API.get(`/files/${roomId}`);
      setFiles(res.data);
    } catch (err) {
      console.error('Failed to load room files.');
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !socket) return;

    const payload = {
      roomId,
      sender: user?.name || 'Anonymous',
      message: inputMsg.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    socket.emit('send-message', payload);
    setInputMsg('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('roomId', roomId);

    setUploading(true);
    try {
      const res = await API.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (socket) {
        socket.emit('file-uploaded', res.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'File upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const sanitizeUrl = (rawUrl: string): string => {
    if (!rawUrl) return '';
    let cleaned = rawUrl.replace(/[\[\]\(\)\"\']/g, '').trim();
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
      return cleaned;
    }
    return `${BACKEND_URL}${cleaned.startsWith('/') ? '' : '/'}${cleaned}`;
  };

  const handleDownloadFile = async (f: any) => {
    const downloadUrl = sanitizeUrl(f.fileUrl);

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Network response was not ok');

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error('Received HTML payload instead of binary file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = f.originalName || f.filename || 'downloaded-file';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.warn('Direct blob stream failed, falling back to direct window access:', err);
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <div className="w-80 h-full bg-slate-800 border-l border-slate-700 flex flex-col">
      <div className="flex border-b border-slate-700 bg-slate-900">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-sm font-semibold flex justify-center items-center gap-2 border-b-2 ${
            activeTab === 'chat' ? 'border-blue-500 text-blue-400 bg-slate-800' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Chat
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-3 text-sm font-semibold flex justify-center items-center gap-2 border-b-2 ${
            activeTab === 'files' ? 'border-blue-500 text-blue-400 bg-slate-800' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Paperclip className="w-4 h-4" /> Files ({files.length})
        </button>
      </div>

      {activeTab === 'chat' ? (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.map((m, idx) => (
              <div key={idx} className="bg-slate-900 p-2.5 rounded-lg border border-slate-700">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-blue-400">{m.sender}</span>
                  <span className="text-[10px] text-slate-500">{m.timestamp}</span>
                </div>
                <p className="text-sm text-slate-200 break-words">{m.message}</p>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 bg-slate-900 border-t border-slate-700 flex gap-2">
            <input
              type="text"
              placeholder="Type message..."
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <button type="submit" className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg">
              <Send className="w-4 h-4 text-white" />
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-4">
          <div className="flex-1 overflow-y-auto space-y-3">
            {files.map((f) => (
              <div key={f._id || f.filename} className="p-3 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  {f.originalName?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                    <ImageIcon className="w-5 h-5 text-blue-400 shrink-0" />
                  ) : (
                    <FileText className="w-5 h-5 text-blue-400 shrink-0" />
                  )}
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-200 truncate">{f.originalName || f.filename}</p>
                    <span className="text-[10px] text-slate-500">{(f.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadFile(f)}
                  className="p-1.5 bg-slate-800 hover:bg-blue-600 rounded shrink-0 transition"
                  title="Download File"
                >
                  <Download className="w-4 h-4 text-slate-300 hover:text-white" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-700">
            <label className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 font-semibold rounded-lg text-sm flex justify-center items-center gap-2 cursor-pointer transition">
              <Paperclip className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Share File'}
              <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};