"use client";

import {
  addDoc,
  collection,
  doc,
  Firestore,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { db } from "../../firebase";

interface CallControlsProps {
  chatId: string;
  localUid: string;
  remoteUid: string | null;
  remoteName?: string;
}

type CallType = "audio" | "video";
type CallState = "idle" | "calling" | "connected";

const getMediaConstraints = (type: CallType): MediaStreamConstraints => ({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: { ideal: 2 },
    sampleRate: { ideal: 48000 },
  },
  video: type === "video" ? {
    facingMode: "user",
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
  } : false,
});

async function requestMedia(type: CallType) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Media devices are not supported by this browser.");
  }

  try {
    return await navigator.mediaDevices.getUserMedia(getMediaConstraints(type));
  } catch (error: any) {
    if (error?.name !== "OverconstrainedError") throw error;
    return navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
  }
}

async function optimizeVideoSender(peer: RTCPeerConnection) {
  const videoSender = peer.getSenders().find((sender) => sender.track?.kind === "video");
  if (!videoSender) return;
  const parameters = videoSender.getParameters();
  const encoding = parameters.encodings?.[0];
  if (!encoding) return;
  encoding.maxBitrate = 2_500_000;
  encoding.maxFramerate = 30;
  try {
    await videoSender.setParameters(parameters);
  } catch {
    // Some browsers expose capture constraints but not sender tuning.
  }
}

async function enterCallView() {
  try {
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // Fullscreen is optional and may be blocked by the browser.
  }

  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: "portrait-primary" | "portrait-secondary") => Promise<void>;
    };
    await orientation.lock?.("portrait-primary");
  } catch {
    // iOS Safari and some desktop browsers do not expose orientation locking.
  }
}

async function exitCallView() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {}
  try {
    screen.orientation.unlock();
  } catch {}
}

export default function CallControls({
  chatId,
  localUid,
  remoteUid,
  remoteName = "this user",
}: CallControlsProps) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callType, setCallType] = useState<CallType | null>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState("");
  const [remoteStreamReady, setRemoteStreamReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const callIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringtoneRef = useRef<AudioContext | null>(null);
  const ringtoneTimerRef = useRef<number | null>(null);

  const stopRingtone = () => {
    if (ringtoneTimerRef.current !== null) window.clearInterval(ringtoneTimerRef.current);
    ringtoneTimerRef.current = null;
    ringtoneRef.current?.close().catch(() => {});
    ringtoneRef.current = null;
  };

  const startRingtone = () => {
    if (ringtoneRef.current || typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    ringtoneRef.current = context;
    const ring = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.setValueAtTime(740, context.currentTime);
      oscillator.frequency.setValueAtTime(880, context.currentTime + 0.18);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.38);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.4);
    };
    ring();
    ringtoneTimerRef.current = window.setInterval(ring, 1400);
  };

  const stopMedia = () => {
    stopRingtone();
    void exitCallView();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerRef.current?.close();
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    peerRef.current = null;
    callIdRef.current = null;
    setRemoteStreamReady(false);
    setCallState("idle");
    setCallType(null);
    setMuted(false);
    setCameraOff(false);
  };

  const addRemoteCandidates = (callId: string, candidateCollection: "callerCandidates" | "calleeCandidates") => {
    if (!db || !peerRef.current) return () => {};
    return onSnapshot(collection(db as Firestore, `calls/${callId}/${candidateCollection}`), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          peerRef.current?.addIceCandidate(change.doc.data()).catch(() => {});
        }
      });
    });
  };

  const createPeer = (type: CallType, callId: string, candidateCollection: "callerCandidates" | "calleeCandidates") => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerRef.current = peer;
    remoteStreamRef.current = new MediaStream();
    peer.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => remoteStreamRef.current?.addTrack(track));
      setRemoteStreamReady(true);
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") setCallState("connected");
      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) stopMedia();
    };
    peer.onicecandidate = async (event) => {
      if (!event.candidate || !db) return;
      await addDoc(collection(db as Firestore, `calls/${callId}/${candidateCollection}`), event.candidate.toJSON());
    };
    void type;
    return peer;
  };

  const startCall = async (type: CallType) => {
    if (!db || !remoteUid || callState !== "idle") return;
    setError("");
    try {
      await enterCallView();
      const stream = await requestMedia(type);
      localStreamRef.current = stream;
      const callRef = await addDoc(collection(db as Firestore, "calls"), {
        chatId,
        callerId: localUid,
        calleeId: remoteUid,
        type,
        status: "ringing",
        createdAt: Timestamp.now(),
      });
      callIdRef.current = callRef.id;
      const peer = createPeer(type, callRef.id, "callerCandidates");
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await optimizeVideoSender(peer);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await updateDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp } });
      setCallType(type);
      setCallState("calling");
    } catch (callError: any) {
      stopMedia();
      setError(callError?.name === "NotAllowedError" ? "Camera or microphone permission was denied." : "Unable to start the call.");
    }
  };

  const acceptCall = async () => {
    if (!db || !incomingCall) return;
    const call = incomingCall;
    setIncomingCall(null);
    stopRingtone();
    setError("");
    try {
      await enterCallView();
      const type = call.type as CallType;
      const stream = await requestMedia(type);
      localStreamRef.current = stream;
      callIdRef.current = call.id;
      const peer = createPeer(type, call.id, "calleeCandidates");
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await optimizeVideoSender(peer);
      await peer.setRemoteDescription(call.offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await updateDoc(doc(db as Firestore, "calls", call.id), {
        answer: { type: answer.type, sdp: answer.sdp },
        status: "accepted",
      });
      setCallType(type);
      setCallState("connected");
      addRemoteCandidates(call.id, "callerCandidates");
    } catch (callError: any) {
      stopMedia();
      setError(callError?.name === "NotAllowedError" ? "Camera or microphone permission was denied." : "Unable to accept the call.");
    }
  };

  const rejectCall = async () => {
    if (db && incomingCall) await updateDoc(doc(db as Firestore, "calls", incomingCall.id), { status: "declined" });
    setIncomingCall(null);
    stopRingtone();
  };

  const hangUp = async () => {
    if (db && callIdRef.current) {
      await updateDoc(doc(db as Firestore, "calls", callIdRef.current), { status: "ended" }).catch(() => {});
    }
    stopMedia();
  };

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!db || !localUid || !remoteUid || remoteUid === "ai") return;
    const incomingQuery = query(
      collection(db as Firestore, "calls"),
      where("calleeId", "==", localUid),
      where("status", "==", "ringing")
    );
    return onSnapshot(incomingQuery, (snapshot) => {
      const call = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .find((item: any) => item.callerId === remoteUid && item.chatId === chatId && item.offer);
      if (call && callState === "idle") setIncomingCall(call);
      if (call && callState === "idle") startRingtone();
    });
  }, [chatId, localUid, remoteUid, callState]);

  useEffect(() => {
    if (!db || !callIdRef.current || callState === "idle") return;
    const callId = callIdRef.current;
    const callRef = doc(db as Firestore, "calls", callId);
    const unsubscribeCall = onSnapshot(callRef, (snapshot) => {
      const data = snapshot.data();
      if (!data) return;
      if (data.status === "declined" || data.status === "ended") stopMedia();
      if (data.answer && peerRef.current?.signalingState === "have-local-offer") {
        peerRef.current.setRemoteDescription(data.answer).then(() => {
          setCallState("connected");
          addRemoteCandidates(callId, "calleeCandidates");
        }).catch(() => setError("The call could not be connected."));
      }
    });
    return () => unsubscribeCall();
  }, [callState]);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    if (remoteVideoRef.current && remoteStreamRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
    if (remoteAudioRef.current && remoteStreamRef.current) remoteAudioRef.current.srcObject = remoteStreamRef.current;
  }, [callState, remoteStreamReady]);

  useEffect(() => () => {
    stopRingtone();
    stopMedia();
  }, []);

  if (!remoteUid || remoteUid === "ai") return null;

  return (
    <>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => startCall("audio")} disabled={callState !== "idle"} className="p-2 rounded-full text-zinc-400 hover:bg-zinc-800/50 hover:text-white disabled:opacity-40 transition-colors" aria-label={`Start audio call with ${remoteName}`} title="Audio call">
          <Phone className="w-5 h-5" />
        </button>
        <button type="button" onClick={() => startCall("video")} disabled={callState !== "idle"} className="p-2 rounded-full text-zinc-400 hover:bg-zinc-800/50 hover:text-white disabled:opacity-40 transition-colors" aria-label={`Start video call with ${remoteName}`} title="Video call">
          <Video className="w-5 h-5" />
        </button>
      </div>

      {mounted && incomingCall && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border border-(--gold-primary)/25 bg-(--dark-card) p-6 text-center shadow-2xl shadow-black/30">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-(--gold-primary)/10 text-(--gold-primary)">
              <span className="absolute inset-0 animate-ping rounded-full border border-(--gold-primary)/40" />
              {incomingCall.type === "video" ? <Video className="h-8 w-8" /> : <Phone className="h-8 w-8" />}
            </div>
            <p className="text-xs uppercase tracking-widest text-(--gold-primary)">Incoming {incomingCall.type} call</p>
            <h3 className="mt-2 text-xl font-bold text-white">{remoteName} is calling</h3>
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" onClick={rejectCall} className="rounded-xl bg-red-500/20 px-5 py-3 font-semibold text-red-200 hover:bg-red-500/30">Decline</button>
              <button type="button" onClick={acceptCall} className="rounded-xl bg-(--gold-primary) px-5 py-3 font-semibold text-black hover:bg-(--gold-light)">Accept</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && callState !== "idle" && createPortal(
        <div className="fixed inset-0 z-50 h-dvh min-h-svh w-screen overflow-hidden bg-black/90 backdrop-blur-md">
          <div className="relative h-full min-h-0 w-full overflow-hidden bg-black sm:mx-auto sm:mt-[5vh] sm:h-[90dvh] sm:max-h-[90dvh] sm:max-w-lg sm:rounded-3xl sm:border sm:border-white/10 sm:bg-(--dark-card) sm:p-4 sm:shadow-2xl">
            <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-linear-to-b from-black/70 to-transparent p-5 pb-12 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:relative sm:bg-transparent sm:p-2 sm:pb-4 sm:pt-2">
              <div>
                <h3 className="text-lg font-bold text-white sm:text-xl">{remoteName}</h3>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">{callType}</span>
            </div>
            <div className="relative h-full min-h-0 overflow-hidden bg-black sm:aspect-video sm:h-auto sm:min-h-0 sm:rounded-2xl">
              {callType === "video" && <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />}
              {callType === "audio" && <audio ref={remoteAudioRef} autoPlay />}
              {callType === "audio" && <div className="flex h-full flex-col items-center justify-center gap-5 bg-(--dark-card) text-(--gold-primary)"><div className="flex h-28 w-28 items-center justify-center rounded-full border border-(--gold-primary)/30 bg-(--gold-primary)/10 text-5xl font-semibold">{remoteName.charAt(0).toUpperCase()}</div><span className="text-sm text-zinc-400">{callState === "calling" ? "Waiting for answer..." : "Audio connected"}</span></div>}
              {callType === "video" && <video ref={localVideoRef} autoPlay muted playsInline className="absolute right-4 top-20 h-32 w-24 scale-x-[-1] rounded-2xl border border-white/30 bg-black object-cover shadow-2xl sm:bottom-4 sm:right-4 sm:top-auto sm:h-32 sm:w-44" />}
            </div>
            {error && <p className="absolute bottom-28 left-5 right-5 z-10 rounded-xl bg-red-950/80 p-3 text-center text-sm text-red-200 sm:relative sm:bottom-auto sm:left-auto sm:right-auto sm:mt-3">{error}</p>}
            <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center gap-4 bg-linear-to-t from-black/80 to-transparent p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:relative sm:bg-transparent sm:p-3">
              <button type="button" onClick={() => { localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = muted; }); setMuted(!muted); }} className="rounded-full bg-white/15 p-4 text-white backdrop-blur-md hover:bg-white/25" aria-label={muted ? "Unmute microphone" : "Mute microphone"} title={muted ? "Unmute microphone" : "Mute microphone"}>{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
              {callType === "video" && <button type="button" onClick={() => { localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = cameraOff; }); setCameraOff(!cameraOff); }} className="rounded-full bg-white/15 p-4 text-white backdrop-blur-md hover:bg-white/25" aria-label={cameraOff ? "Turn camera on" : "Turn camera off"} title={cameraOff ? "Turn camera on" : "Turn camera off"}>{cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}</button>}
              <button type="button" onClick={hangUp} className="rounded-full bg-red-500 p-4 text-white shadow-lg shadow-red-500/30 hover:bg-red-600" aria-label="End call" title="End call"><PhoneOff className="h-5 w-5" /></button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
