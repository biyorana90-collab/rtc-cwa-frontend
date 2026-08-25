import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import API from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Video, Plus, LogOut, Clock, Link as LinkIcon, RotateCcw, User, Users, Calendar, Edit3, X, Check } from 'lucide-react';

interface Participant {
  _id?: string;
  name: string;
  email?: string;
  avatar?: string;
}

interface MeetingItem {
  _id?: string;
  roomId: string;
  title?: string;
  createdAt?: string;
  scheduledTime?: string;
  status?: 'upcoming' | 'ongoing' | 'ended';
  isHost?: boolean;
  isEnded?: boolean;
  participants?: Participant[];
}

export const Dashboard: React.FC = () => {
  const { user, logout } = useContext(AuthContext);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [history, setHistory] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Profile Edit Modal State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileAvatar, setProfileAvatar] = useState((user as any)?.avatar || '😎');
  const [savingProfile, setSavingProfile] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (user?.name) setProfileName(user.name);
    if ((user as any)?.avatar) setProfileAvatar((user as any).avatar);
  }, [user]);

  const fetchHistory = async () => {
    try {
      let res;
      try {
        res = await API.get('/meetings/my-meetings');
      } catch {
        res = await API.get('/meetings/history');
      }

      if (Array.isArray(res.data)) {
        setHistory(res.data);
      }
    } catch (err) {
      console.error('Failed to load meeting history:', err);
    }
  };

  const handleCreateMeeting = async () => {
    setLoading(true);
    try {
      const res = await API.post('/meetings/create', { title: meetingTitle });
      const createdRoomId = res.data?.roomId;

      if (createdRoomId) {
        localStorage.setItem(`isHost_${createdRoomId}`, 'true');
        navigate(`/room/${createdRoomId}`, { state: { isHost: true } });
      } else {
        alert('Meeting created, but no Room ID was returned.');
      }
    } catch (err) {
      console.error('Create meeting error:', err);
      alert('Failed to create meeting room.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRoomId = joinRoomId.trim();

    if (cleanRoomId) {
      try {
        const res = await API.post(`/meetings/join/${cleanRoomId}`);
        const isHost = Boolean(res.data?.isHost);

        if (isHost) {
          localStorage.setItem(`isHost_${cleanRoomId}`, 'true');
        }

        navigate(`/room/${cleanRoomId}`, { state: { isHost } });
      } catch (err) {
        console.warn('Meeting join request failed:', err);
        navigate(`/room/${cleanRoomId}`, { state: { isHost: false } });
      }
    }
  };

  const handleRejoinMeeting = (roomId: string, isHostRole?: boolean) => {
    const isHost = Boolean(isHostRole);
    if (isHost) {
      localStorage.setItem(`isHost_${roomId}`, 'true');
    }
    navigate(`/room/${roomId}`, { state: { isHost } });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await API.put('/auth/profile', { name: profileName, avatar: profileAvatar });
      setIsProfileOpen(false);
      window.location.reload();
    } catch (err) {
      console.error('Profile update failed:', err);
      alert('Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const upcomingMeetings = history.filter(m => m.status === 'upcoming' || (m.scheduledTime && new Date(m.scheduledTime) > new Date()));
  const pastMeetings = history.filter(m => m.status !== 'upcoming' && (!m.scheduledTime || new Date(m.scheduledTime) <= new Date()));

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 py-4 px-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Video className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-wide">RealTime Connect</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition"
          >
            <User className="w-4 h-4 text-blue-400" />
            <span>{user?.name || 'User'}</span>
            <Edit3 className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-red-600/80 rounded-lg text-sm transition"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      {/* Profile Edit Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setIsProfileOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" /> Manage Profile
            </h3>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Avatar Emoji / Icon</label>
                <input
                  type="text"
                  value={profileAvatar}
                  onChange={(e) => setProfileAvatar(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="e.g. 👨‍💻 or 😎"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Body */}
      <main className="max-w-6xl mx-auto p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Create Meeting Card */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" /> Start New Instant Meeting
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                Create a high-definition real-time meeting room as host and invite participants with a link.
              </p>
              <input
                type="text"
                placeholder="Meeting Title (Optional)"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white mb-4 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleCreateMeeting}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 font-semibold rounded-lg transition duration-200 disabled:opacity-50"
            >
              {loading ? 'Creating Room...' : 'Create Instant Meeting'}
            </button>
          </div>

          {/* Join Meeting Card */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-green-400" /> Join Existing Meeting
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                Enter a Room ID shared by the meeting host to join the live session instantly as a participant.
              </p>
              <form onSubmit={handleJoinMeeting}>
                <input
                  type="text"
                  required
                  placeholder="Enter Room ID (e.g., abc123x)"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white mb-4 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 font-semibold rounded-lg transition duration-200"
                >
                  Join Session
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Upcoming Meetings Section */}
        {upcomingMeetings.length > 0 && (
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-400">
              <Calendar className="w-5 h-5" /> Upcoming Scheduled Meetings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingMeetings.map((m) => (
                <div key={m._id || m.roomId} className="p-4 bg-slate-900 border border-slate-700 rounded-lg flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-white">{m.title || 'Scheduled Meeting'}</h3>
                    <p className="text-xs text-slate-400">Room: {m.roomId}</p>
                    {m.scheduledTime && (
                      <p className="text-xs text-blue-400 mt-1">📅 {new Date(m.scheduledTime).toLocaleString()}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRejoinMeeting(m.roomId, m.isHost)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-semibold"
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Meeting History Section */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" /> Recent Meeting History
          </h2>

          {pastMeetings.length === 0 ? (
            <p className="text-slate-400 text-sm">No recent meetings found.</p>
          ) : (
            <div className="space-y-3">
              {pastMeetings.map((m) => (
                <div
                  key={m._id || m.roomId}
                  className="p-4 bg-slate-900 border border-slate-700 rounded-lg flex justify-between items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-blue-400">{m.title || 'Instant Meeting'}</h3>
                      {m.isHost && (
                        <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded text-[10px] font-semibold">
                          Host
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>Room ID: {m.roomId}</span>
                      {m.participants && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <Users className="w-3 h-3 text-slate-400" /> {m.participants.length} Participant(s)
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRejoinMeeting(m.roomId, m.isHost)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 rounded text-sm font-medium transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Rejoin
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};