import React, { useEffect, useRef, useState, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import { Whiteboard } from '../components/Whiteboard';
import { ChatAndFilesPanel } from '../components/ChatAndFilesPanel';
import API from '../services/api';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  PhoneOff,
  PenTool,
  Layout,
  Copy,
  Check,
  ShieldAlert,
  Hand,
  Disc,
  Sun,
  Moon
} from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
};

interface PeerData {
  userName?: string;
  isHost?: boolean;
  isHandRaised?: boolean;
  isVideoMuted?: boolean;
  stream?: MediaStream;
}

const RemoteVideoPlayer: React.FC<{ stream?: MediaStream }> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const videoEl = videoRef.current;

    if (videoEl && stream) {
      videoEl.srcObject = stream;
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (isMounted && err.name !== 'AbortError') {
            console.warn('Playback deferred:', err);
          }
        });
      }
    }

    return () => {
      isMounted = false;
      if (videoEl) videoEl.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={(el) => {
        videoRef.current = el;
        if (el && stream && el.srcObject !== stream) {
          el.srcObject = stream;
          el.play().catch(() => {});
        }
      }}
      autoPlay
      playsInline
      className="w-full h-full object-cover block"
    />
  );
};

export const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = user as any;

  const [isHost, setIsHost] = useState<boolean>(
    location.state?.isHost ?? (localStorage.getItem(`isHost_${roomId}`) === 'true')
  );

  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<{ [key: string]: PeerData }>({});
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [hasWhiteboardPermission, setHasWhiteboardPermission] = useState(false);
  const [hasScreensharePermission, setHasScreensharePermission] = useState(false);
  const [permissionRequest, setPermissionRequest] = useState<{ type: 'whiteboard' | 'screenshare'; requesterSocketId: string; userName: string } | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    const registerParticipant = async () => {
      if (!roomId) return;
      try {
        let res;
        try {
          res = await API.post(`/meetings/join/${roomId}`);
        } catch {
          res = await API.post(`/api/meetings/join/${roomId}`);
        }
        if (res.data?.isHost !== undefined) {
          const verifiedIsHost = !!res.data.isHost;
          setIsHost(verifiedIsHost);
          if (verifiedIsHost) {
            localStorage.setItem(`isHost_${roomId}`, 'true');
          } else {
            localStorage.removeItem(`isHost_${roomId}`);
          }
        }
      } catch (err) {
        console.warn('Meeting registration fallback handled:', err);
      }
    };
    registerParticipant();
  }, [roomId]);

  useEffect(() => {
    if (isHost) {
      localStorage.setItem(`isHost_${roomId}`, 'true');
    }

    const rawSocketUrl = (import.meta as any).env?.VITE_SOCKET_URL || 'https://rtc-cwa-backend-production.up.railway.app';
    const cleanSocketUrl = rawSocketUrl.trim().replace(/[\[\]\(\)\"\']/g, '').replace(/\/+$/, '');
    const socketUrl = cleanSocketUrl.startsWith('http') ? cleanSocketUrl : `https://${cleanSocketUrl}`;

    const newSocket = io(socketUrl, {
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
    });
    setSocket(newSocket);

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        const initialVideoState = videoTrack ? !videoTrack.enabled : false;
        setIsVideoOff(initialVideoState);
        if (audioTrack) setIsAudioMuted(!audioTrack.enabled);

        if (localVideoRef.current && !initialVideoState) {
          localVideoRef.current.srcObject = stream;
        }

        newSocket.emit('join-room', {
          roomId,
          userId: currentUser?._id,
          userName: currentUser?.name || 'User',
          isHost,
          isVideoOff: initialVideoState
        });
      })
      .catch(() => {
        setIsVideoOff(true);
        setIsAudioMuted(true);
        newSocket.emit('join-room', {
          roomId,
          userId: currentUser?._id,
          userName: currentUser?.name || 'User',
          isHost,
          isVideoOff: true
        });
      });

    return () => {
      newSocket.disconnect();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId, isHost]);

  useEffect(() => {
    if (!socket) return;

    socket.on('user-joined', async ({ socketId, userName, isHost: remoteIsHost, isVideoOff: remoteVideoState }) => {
      setPeers((prev) => ({
        ...prev,
        [socketId]: {
          userName: userName || 'Participant',
          isHost: remoteIsHost || false,
          isVideoMuted: remoteVideoState ?? false,
        },
      }));

      const pc = createPeerConnection(socketId, userName, remoteIsHost, remoteVideoState);
      peerConnections.current[socketId] = pc;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { targetSocketId: socketId, offer, userName: currentUser?.name, isVideoOff });
      } catch (err) {
        console.error('Failed to create peer offer:', err);
      }
    });

    socket.on('offer', async ({ senderSocketId, offer, userName, isVideoOff: remoteVideoState }) => {
      setPeers((prev) => ({
        ...prev,
        [senderSocketId]: {
          ...prev[senderSocketId],
          userName: userName || prev[senderSocketId]?.userName || 'Participant',
          isVideoMuted: remoteVideoState ?? prev[senderSocketId]?.isVideoMuted ?? false,
        },
      }));

      let pc = peerConnections.current[senderSocketId];
      if (!pc) {
        pc = createPeerConnection(senderSocketId, userName, false, remoteVideoState);
        peerConnections.current[senderSocketId] = pc;
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current!);
          });
        }
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { targetSocketId: senderSocketId, answer });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    });

    socket.on('answer', async ({ senderSocketId, answer }) => {
      const pc = peerConnections.current[senderSocketId];
      if (pc && pc.signalingState !== 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('Error setting remote answer:', err);
        }
      }
    });

    socket.on('ice-candidate', async ({ senderSocketId, candidate }) => {
      const pc = peerConnections.current[senderSocketId];
      if (pc && candidate && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE Candidate:', err);
        }
      }
    });

    socket.on('remote-whiteboard-toggle', ({ show }: { show: boolean }) => {
      setShowWhiteboard(show);
    });

    socket.on('force-mute-audio', () => {
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = false;
          setIsAudioMuted(true);
        }
      }
    });

    socket.on('force-disable-camera', () => {
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = false;
          setIsVideoOff(true);
          if (socket && roomId) {
            socket.emit('toggle-camera', { roomId, isVideoOff: true });
          }
        }
      }
    });

    socket.on('camera-toggled', ({ socketId, isVideoOff: remoteVideoState }: { socketId: string; isVideoOff: boolean }) => {
      setPeers((prev) => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: { ...prev[socketId], isVideoMuted: remoteVideoState },
        };
      });
    });

    socket.on('hand-raise-updated', ({ socketId, isHandRaised: remoteHandState }) => {
      setPeers((prev) => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: { ...prev[socketId], isHandRaised: remoteHandState },
        };
      });
    });

    socket.on('whiteboard-permission-requested', ({ requesterSocketId, userName }) => {
      if (isHost) setPermissionRequest({ type: 'whiteboard', requesterSocketId, userName });
    });

    socket.on('screenshare-permission-requested', ({ requesterSocketId, userName }) => {
      if (isHost) setPermissionRequest({ type: 'screenshare', requesterSocketId, userName });
    });

    socket.on('whiteboard-permission-response', ({ approved }) => {
      if (approved) {
        setHasWhiteboardPermission(true);
        setShowWhiteboard(true);
        socket.emit('toggle-whiteboard', { roomId, show: true });
      } else {
        alert('Host denied your request to open whiteboard.');
      }
    });

    socket.on('screenshare-permission-response', async ({ approved }) => {
      if (approved) {
        setHasScreensharePermission(true);
        await startScreenShare();
      } else {
        alert('Host denied your request to share screen.');
      }
    });

    socket.on('meeting-ended', () => {
      cleanupAndExit();
      alert('The host has ended the meeting for all participants.');
    });

    socket.on('user-left', ({ socketId }) => {
      if (peerConnections.current[socketId]) {
        peerConnections.current[socketId].close();
        delete peerConnections.current[socketId];
      }
      setPeers((prev) => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
    });

    return () => {
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('remote-whiteboard-toggle');
      socket.off('force-mute-audio');
      socket.off('force-disable-camera');
      socket.off('camera-toggled');
      socket.off('hand-raise-updated');
      socket.off('whiteboard-permission-requested');
      socket.off('screenshare-permission-requested');
      socket.off('whiteboard-permission-response');
      socket.off('screenshare-permission-response');
      socket.off('meeting-ended');
      socket.off('user-left');
    };
  }, [socket, isHost, isVideoOff, navigate]);

  const createPeerConnection = (targetSocketId: string, userName?: string, isHostRole?: boolean, isVideoMutedInit = false) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', { targetSocketId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      setPeers((prev) => {
        const currentPeer = prev[targetSocketId] || {};
        return {
          ...prev,
          [targetSocketId]: {
            ...currentPeer,
            userName: userName || currentPeer.userName,
            isHost: isHostRole !== undefined ? isHostRole : currentPeer.isHost,
            isVideoMuted: currentPeer.isVideoMuted ?? isVideoMutedInit,
            stream: remoteStream,
          },
        };
      });
    };

    return pc;
  };

  const renegotiatePeers = async () => {
    if (!socket) return;
    for (const [targetSocketId, pc] of Object.entries(peerConnections.current)) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { targetSocketId, offer, userName: currentUser?.name, isVideoOff: false });
      } catch (err) {
        console.error('Error renegotiating offer:', err);
      }
    }
  };

  const toggleCamera = async () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const nextEnabledState = !videoTrack.enabled;
    videoTrack.enabled = nextEnabledState;
    const isMutedNow = !nextEnabledState;

    setIsVideoOff(isMutedNow);

    Object.values(peerConnections.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        sender.track!.enabled = nextEnabledState;
      }
    });

    if (socket && roomId) {
      socket.emit('toggle-camera', { roomId, isVideoOff: isMutedNow });
    }
  };

  const handleToggleWhiteboard = () => {
    if (!isHost && !hasWhiteboardPermission) {
      if (socket) {
        socket.emit('request-whiteboard-permission', { roomId });
        alert('Permission request sent to host to open whiteboard.');
      }
      return;
    }
    const nextState = !showWhiteboard;
    setShowWhiteboard(nextState);
    if (socket) {
      socket.emit('toggle-whiteboard', { roomId, show: nextState });
    }
  };

  const respondToPermission = (approved: boolean) => {
    if (!socket || !permissionRequest) return;
    if (permissionRequest.type === 'whiteboard') {
      socket.emit('respond-whiteboard-permission', {
        targetSocketId: permissionRequest.requesterSocketId,
        approved,
      });
    } else {
      socket.emit('respond-screenshare-permission', {
        targetSocketId: permissionRequest.requesterSocketId,
        approved,
      });
    }
    setPermissionRequest(null);
  };

  const toggleHandRaise = () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    if (socket && roomId) {
      socket.emit('raise-hand', { roomId, isHandRaised: nextState });
    }
  };

  const toggleScreenRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        recordedChunks.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunks.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `meeting-rec-${roomId}-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (err) {
        console.error('Failed screen recording:', err);
      }
    }
  };

  const muteParticipant = (targetSocketId: string) => {
    if (socket && isHost) socket.emit('host-mute-participant', { targetSocketId });
  };

  const disableParticipantCamera = (targetSocketId: string) => {
    if (socket && isHost) socket.emit('host-disable-camera', { targetSocketId });
  };

  const copyRoomInvite = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      if (!isHost && !hasScreensharePermission) {
        if (socket) {
          socket.emit('request-screenshare-permission', { roomId });
          alert('Permission request sent to host to share screen.');
        }
        return;
      }
      await startScreenShare();
    } else {
      stopScreenShare();
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      for (const pc of Object.values(peerConnections.current)) {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          pc.addTrack(screenTrack, screenStream);
        }
      }

      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
      screenTrack.onended = () => stopScreenShare();
      setIsScreenSharing(true);
      setIsVideoOff(false);

      if (socket && roomId) {
        socket.emit('toggle-camera', { roomId, isVideoOff: false });
      }

      await renegotiatePeers();
    } catch (err) {
      console.error('Screen sharing error:', err);
    }
  };

  const stopScreenShare = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      for (const pc of Object.values(peerConnections.current)) {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender && videoTrack) {
          await videoSender.replaceTrack(videoTrack);
        }
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      const isCamOff = !videoTrack || !videoTrack.enabled;
      setIsVideoOff(isCamOff);

      if (socket && roomId) {
        socket.emit('toggle-camera', { roomId, isVideoOff: isCamOff });
      }

      await renegotiatePeers();
    }
    setIsScreenSharing(false);
  };

  const cleanupAndExit = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};
    localStorage.removeItem(`isHost_${roomId}`);
    navigate('/dashboard');
  };

  const leaveRoom = () => {
    if (socket) socket.emit('leave-meeting', { roomId });
    cleanupAndExit();
  };

  const endMeetingForAll = () => {
    if (!isHost) return;
    if (socket) socket.emit('end-meeting', { roomId });
    cleanupAndExit();
  };

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}>
      {isHost && permissionRequest && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl text-white">
            <h3 className="text-lg font-bold mb-2">Permission Requested</h3>
            <p className="text-sm text-slate-300 mb-6">
              <span className="font-semibold text-blue-400">{permissionRequest.userName}</span> requested permission to{' '}
              {permissionRequest.type === 'whiteboard' ? 'open the whiteboard' : 'share screen'}.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => respondToPermission(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold"
              >
                Deny
              </button>
              <button
                onClick={() => respondToPermission(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white"
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`h-14 px-6 flex justify-between items-center shrink-0 border-b ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-blue-500 text-lg">Room: {roomId}</span>
          {isHost && (
            <span className="px-2 py-0.5 bg-blue-600/30 text-blue-500 border border-blue-500/40 rounded text-xs font-semibold">
              Host
            </span>
          )}
          <button
            onClick={copyRoomInvite}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded-md transition-colors ${
              darkMode ? 'bg-slate-700 hover:bg-slate-600 border-slate-600' : 'bg-slate-100 hover:bg-slate-200 border-slate-300'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied Link' : 'Copy Invite Link'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-1.5 rounded-lg border transition ${darkMode ? 'bg-slate-700 border-slate-600 text-yellow-400' : 'bg-slate-200 border-slate-300 text-slate-700'}`}
            title="Toggle Theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={handleToggleWhiteboard}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg flex items-center gap-2 border transition ${
              showWhiteboard ? 'bg-blue-600 text-white border-blue-500' : darkMode ? 'bg-slate-700 border-slate-600 hover:bg-slate-600' : 'bg-slate-200 border-slate-300 hover:bg-slate-300'
            }`}
          >
            {showWhiteboard ? <Layout className="w-4 h-4" /> : <PenTool className="w-4 h-4" />}
            {showWhiteboard ? 'Show Video Grid' : isHost ? 'Focus Whiteboard (All)' : 'Request Whiteboard Access'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          {showWhiteboard ? (
            <Whiteboard
              socket={socket}
              roomId={roomId || ''}
              isHost={isHost}
              canEdit={isHost || hasWhiteboardPermission}
            />
          ) : (
            <div className={`grid gap-4 flex-1 auto-rows-fr ${Object.keys(peers).length === 0 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
              <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center shadow-lg">
                {!isVideoOff ? (
                  <video
                    ref={(el) => {
                      localVideoRef.current = el;
                      if (el && localStream && el.srcObject !== localStream) {
                        el.srcObject = localStream;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover block"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-2xl font-bold text-blue-400">
                      {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="text-xs text-slate-400 font-medium">Camera is off</span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <span className="bg-slate-900/80 text-white px-3 py-1 rounded text-xs border border-slate-700">
                    {currentUser?.name || 'You'} (You) {isHost ? '[Host]' : ''}
                  </span>
                  {isHandRaised && <Hand className="w-4 h-4 text-yellow-400 animate-bounce" />}
                </div>
              </div>

              {Object.entries(peers).map(([id, peer]) => {
                const isMuted = !!peer.isVideoMuted;

                return (
                  <div key={id} className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center shadow-lg">
                    {!isMuted && peer.stream ? (
                      <RemoteVideoPlayer stream={peer.stream} />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-2xl font-bold text-blue-400">
                          {peer.userName?.charAt(0).toUpperCase() || 'P'}
                        </div>
                        <span className="text-xs text-slate-400 font-medium">Camera is off</span>
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                      <span className="bg-slate-900/80 text-white px-3 py-1 rounded text-xs border border-slate-700">
                        {peer.userName || 'Participant'} {peer.isHost ? '[Host]' : ''}
                      </span>
                      {peer.isHandRaised && <Hand className="w-4 h-4 text-yellow-400 animate-bounce" />}
                    </div>
                    {isHost && (
                      <div className="absolute top-3 right-3 flex gap-2">
                        <button
                          onClick={() => muteParticipant(id)}
                          className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-red-500 shadow-lg transition"
                          title="Mute Participant"
                        >
                          <MicOff className="w-3.5 h-3.5" /> Mute
                        </button>
                        <button
                          onClick={() => disableParticipantCamera(id)}
                          className="p-2 bg-slate-800/90 hover:bg-red-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-600 shadow-lg transition"
                          title="Turn Off Camera"
                        >
                          <VideoOff className="w-3.5 h-3.5" /> Stop Video
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <ChatAndFilesPanel socket={socket} roomId={roomId || ''} />
      </div>

      <div className={`h-16 flex justify-center items-center gap-4 shrink-0 border-t ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <button
          onClick={toggleMic}
          className={`p-3 rounded-full border transition ${isAudioMuted ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'}`}
          title="Toggle Microphone"
        >
          {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <button
          onClick={toggleCamera}
          className={`p-3 rounded-full border transition ${isVideoOff ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'}`}
          title="Toggle Camera"
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
        </button>
        <button
          onClick={toggleScreenShare}
          className={`p-3 rounded-full border transition ${isScreenSharing ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'}`}
          title={isHost || hasScreensharePermission ? 'Share Screen' : 'Request Screen Share Permission'}
        >
          <Monitor className="w-5 h-5" />
        </button>
        <button
          onClick={toggleHandRaise}
          className={`p-3 rounded-full border transition ${isHandRaised ? 'bg-yellow-500 border-yellow-400 text-slate-950' : 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'}`}
          title="Raise/Lower Hand"
        >
          <Hand className="w-5 h-5" />
        </button>
        <button
          onClick={toggleScreenRecording}
          className={`p-3 rounded-full border transition ${isRecording ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'}`}
          title={isRecording ? 'Stop Recording' : 'Start Screen Recording'}
        >
          <Disc className="w-5 h-5" />
        </button>
        <button
          onClick={leaveRoom}
          className="p-3 rounded-full bg-slate-700 hover:bg-slate-600 border border-slate-600 text-red-400 transition"
          title="Leave Meeting (Only You)"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
        {isHost && (
          <button
            onClick={endMeetingForAll}
            className="px-4 py-2.5 rounded-full bg-red-600 hover:bg-red-700 border border-red-500 text-white text-xs font-bold transition flex items-center gap-2"
            title="End Meeting for All Participants"
          >
            <ShieldAlert className="w-4 h-4" /> End Call for All
          </button>
        )}
      </div>
    </div>
  );
};