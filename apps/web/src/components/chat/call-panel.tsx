'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useMe } from '@/hooks/use-me';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * WebRTC group call. Peer-to-peer mesh — every participant maintains one
 * RTCPeerConnection per remote participant. Signaling (SDP offer/answer +
 * ICE candidates) rides on our existing Socket.io connection:
 *   call:start   emitted when we launch → others get an incoming ring
 *   call:join    we broadcast on entry so already-in-call peers reply
 *                with an offer directed at us
 *   call:signal  { targetUserId, payload } — offer/answer/ice relayed
 *                by the server to the target's user room
 *   call:leave   we broadcast on hang up so everyone tears down
 *
 * Media is captured with getUserMedia respecting the requested `mode`
 * (audio-only vs video). Users can mute/blank at any time.
 *
 * We don't run a TURN server — most Ethiopian ISPs are behind CGNAT which
 * usually blocks pure STUN traversal. So we ALSO surface a warning when
 * a peer connection fails to gather relays. A future upgrade is a free
 * TURN via Metered / Twilio / Cloudflare Calls.
 */
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(`${API_URL}/v1/push/ice-servers`);
    if (!res.ok) return DEFAULT_ICE_SERVERS;
    const j = (await res.json()) as { data?: { servers?: RTCIceServer[] } };
    return j.data?.servers?.length ? j.data.servers : DEFAULT_ICE_SERVERS;
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
}

interface Props {
  conversationId: string;
  mode: 'audio' | 'video';
  onEnd: () => void;
}

export function CallPanel({ conversationId, mode, onEnd }: Props) {
  const token = useAuthStore((s) => s.accessToken);
  const { data: me } = useMe();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<Record<string, MediaStream>>({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(mode === 'audio');
  const [phase, setPhase] = useState<'starting' | 'connecting' | 'live' | 'error'>('starting');
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const localRef = useRef<HTMLVideoElement | null>(null);
  const iceRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);

  // Fetch fresh ICE servers (may include TURN) once on mount.
  useEffect(() => {
    let cancelled = false;
    fetchIceServers().then((s) => { if (!cancelled) iceRef.current = s; });
    return () => { cancelled = true; };
  }, []);

  const localVideoOk = mode === 'video' && !cameraOff;

  // ---- Media capture -----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Browsers only expose mediaDevices on a secure context (HTTPS or
      // localhost). Give a friendly, actionable message instead of a raw
      // stack trace when we're on plain HTTP or an old browser.
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setError('Your browser does not support live calls, or this page is not being served over HTTPS.');
        setPhase('error');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true, video: mode === 'video',
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        setLocalStream(stream);
        setPhase('connecting');
      } catch (err) {
        const name = (err as { name?: string }).name || '';
        const msg = (err as Error).message || '';
        let friendly = msg || 'Microphone / camera access denied';
        if (name === 'NotAllowedError' || /permission/i.test(msg)) {
          friendly = mode === 'video'
            ? 'Camera & microphone permission denied. Tap the 🔒 lock icon in the address bar → Site settings → allow Camera and Microphone, then rejoin.'
            : 'Microphone permission denied. Tap the 🔒 lock icon in the address bar → Site settings → allow Microphone, then rejoin.';
        } else if (name === 'NotFoundError') {
          friendly = 'No microphone or camera detected on this device.';
        } else if (name === 'NotReadableError') {
          friendly = 'Your camera or microphone is being used by another app. Close it and try again.';
        }
        setError(friendly);
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [mode]);

  // ---- Attach local stream to <video> -----
  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream;
      localRef.current.muted = true; // never hear yourself
      void localRef.current.play().catch(() => undefined);
    }
  }, [localStream]);

  // ---- Socket + signaling -----
  const buildPeer = useCallback((targetUserId: string, sendOffer: boolean) => {
    if (pcsRef.current[targetUserId]) return pcsRef.current[targetUserId];
    const pc = new RTCPeerConnection({ iceServers: iceRef.current });

    // Push our local tracks.
    localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));

    pc.ontrack = (e) => {
      // Every remote peer sends up to one audio + one video track. Accumulate.
      setRemotes((prev) => {
        const existing = prev[targetUserId] ?? new MediaStream();
        e.streams[0]?.getTracks().forEach((t) => {
          if (!existing.getTracks().find((x) => x.id === t.id)) existing.addTrack(t);
        });
        return { ...prev, [targetUserId]: existing };
      });
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit('call:signal', {
          conversationId, targetUserId,
          payload: { type: 'ice', candidate: e.candidate.toJSON() },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setPhase('live');
      if (pc.connectionState === 'failed') {
        toast.error('Call peer disconnected');
      }
    };

    pcsRef.current[targetUserId] = pc;

    if (sendOffer) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer).then(() => offer))
        .then((offer) => {
          socketRef.current?.emit('call:signal', {
            conversationId, targetUserId,
            payload: { type: 'offer', sdp: offer.sdp },
          });
        })
        .catch((e) => { toast.error('Failed to negotiate call: ' + (e as Error).message); });
    }

    return pc;
  }, [conversationId, localStream]);

  useEffect(() => {
    if (!token || !localStream) return;
    const sock = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = sock;

    sock.on('connect', () => {
      sock.emit('conversation:join', conversationId, () => {
        sock.emit('call:join', conversationId);
        sock.emit('call:start', conversationId, mode);
      });
    });

    // A peer joined — we send them an offer.
    sock.on('call:join', ({ from }: { from: string }) => {
      if (!from || from === me?.id) return;
      buildPeer(from, true);
    });

    // A peer left — tear their PC down.
    sock.on('call:leave', ({ from }: { from: string }) => {
      pcsRef.current[from]?.close();
      delete pcsRef.current[from];
      setRemotes((prev) => {
        const next = { ...prev };
        delete next[from];
        return next;
      });
    });

    // Someone else ended the whole call.
    sock.on('call:end', () => onEnd());

    // Signaling relay.
    sock.on('call:signal', async ({ from, payload }: { from: string; payload: { type: string; sdp?: string; candidate?: RTCIceCandidateInit } }) => {
      if (!from || from === me?.id) return;
      const pc = buildPeer(from, false);
      try {
        if (payload.type === 'offer' && payload.sdp) {
          await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sock.emit('call:signal', {
            conversationId, targetUserId: from,
            payload: { type: 'answer', sdp: answer.sdp },
          });
        } else if (payload.type === 'answer' && payload.sdp) {
          await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
        } else if (payload.type === 'ice' && payload.candidate) {
          await pc.addIceCandidate(payload.candidate);
        }
      } catch (e) {
        // Rarely fatal — often just a race on ICE add before remote-desc is set.
        console.warn('signal error', e);
      }
    });

    return () => {
      sock.emit('call:leave', conversationId);
      sock.emit('call:end', conversationId);
      Object.values(pcsRef.current).forEach((pc) => pc.close());
      pcsRef.current = {};
      sock.disconnect();
      socketRef.current = null;
      localStream?.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, localStream, conversationId, mode, me?.id]);

  const toggleMute = () => {
    if (!localStream) return;
    const next = !muted;
    setMuted(next);
    localStream.getAudioTracks().forEach((t) => { t.enabled = !next; });
  };
  const toggleCamera = () => {
    if (!localStream) return;
    const next = !cameraOff;
    setCameraOff(next);
    localStream.getVideoTracks().forEach((t) => { t.enabled = !next; });
  };

  const remoteEntries = useMemo(() => Object.entries(remotes), [remotes]);

  return (
    <div className="fixed inset-0 z-[110] bg-black text-white">
      {/* Grid */}
      <div className={cn(
        'grid h-full w-full gap-1 p-1',
        remoteEntries.length === 0 ? 'grid-cols-1' :
          remoteEntries.length === 1 ? 'grid-cols-1' :
          remoteEntries.length <= 4 ? 'grid-cols-2' :
          'grid-cols-3',
      )}>
        {remoteEntries.map(([userId, stream]) => (
          <RemoteTile key={userId} userId={userId} stream={stream} />
        ))}
        {remoteEntries.length === 0 && (
          <div className="grid place-items-center px-6">
            <div className="max-w-sm text-center">
              {phase === 'error' ? (
                <>
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-500/20 text-2xl">
                    ⚠️
                  </div>
                  <div className="mt-3 text-base font-semibold">Can&rsquo;t start call</div>
                  <div className="mt-2 text-sm leading-relaxed opacity-90">{error}</div>
                  <button
                    onClick={onEnd}
                    className="mt-5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="mx-auto h-8 w-8 animate-spin opacity-60" />
                  <div className="mt-3 text-sm opacity-80">
                    {phase === 'starting' ? 'Starting camera / mic…' :
                      phase === 'connecting' ? 'Waiting for others to join…' :
                      'Connecting…'}
                  </div>
                  <div className="mt-1 text-[11px] opacity-60">
                    <Users className="mr-1 inline h-3 w-3" /> Everyone in this chat can join
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Local preview */}
      {localVideoOk && (
        <video
          ref={localRef}
          autoPlay muted playsInline
          className="safe-top absolute right-3 top-3 h-32 w-24 rounded-xl object-cover shadow-lg ring-2 ring-white/40"
        />
      )}

      {/* Controls */}
      <div className="safe-bottom absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 p-6">
        <button onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}
          className={cn('grid h-14 w-14 place-items-center rounded-full text-white transition-transform active:scale-90',
            muted ? 'bg-white/25 backdrop-blur' : 'bg-white/15 backdrop-blur')}>
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        {mode === 'video' && (
          <button onClick={toggleCamera} aria-label={cameraOff ? 'Turn on camera' : 'Turn off camera'}
            className={cn('grid h-14 w-14 place-items-center rounded-full text-white transition-transform active:scale-90',
              cameraOff ? 'bg-white/25 backdrop-blur' : 'bg-white/15 backdrop-blur')}>
            {cameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </button>
        )}
        <button onClick={onEnd} aria-label="End call"
          className="grid h-14 w-14 place-items-center rounded-full bg-red-600 text-white shadow-xl active:scale-90">
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

function RemoteTile({ userId, stream }: { userId: string; stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current) { ref.current.srcObject = stream; void ref.current.play().catch(() => undefined); }
  }, [stream]);
  return (
    <div className="relative overflow-hidden rounded-xl bg-neutral-800">
      <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />
      <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold backdrop-blur">
        {userId.slice(-6)}
      </div>
    </div>
  );
}
