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
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const callIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const stopMedia = () => {
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
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
    setError("");
    try {
      const type = call.type as CallType;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
      localStreamRef.current = stream;
      callIdRef.current = call.id;
      const peer = createPeer(type, call.id, "calleeCandidates");
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
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
  };

  const hangUp = async () => {
    if (db && callIdRef.current) {
      await updateDoc(doc(db as Firestore, "calls", callIdRef.current), { status: "ended" }).catch(() => {});
    }
    stopMedia();
  };

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

  useEffect(() => () => stopMedia(), []);

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

      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-(--dark-card) p-6 text-center shadow-2xl">
            <p className="text-xs uppercase tracking-widest text-(--gold-primary)">Incoming {incomingCall.type} call</p>
            <h3 className="mt-2 text-xl font-bold text-white">{remoteName} is calling</h3>
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" onClick={rejectCall} className="rounded-xl bg-red-500/20 px-5 py-3 font-semibold text-red-200 hover:bg-red-500/30">Decline</button>
              <button type="button" onClick={acceptCall} className="rounded-xl bg-(--gold-primary) px-5 py-3 font-semibold text-black hover:bg-(--gold-light)">Accept</button>
            </div>
          </div>
        </div>
      )}

      {callState !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-(--dark-card) p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-(--gold-primary)">{callState === "calling" ? "Calling" : "Connected"}</p>
                <h3 className="text-xl font-bold text-white">{remoteName}</h3>
              </div>
              <button type="button" onClick={hangUp} className="rounded-full bg-red-500/20 p-3 text-red-300 hover:bg-red-500/30" aria-label="End call" title="End call"><PhoneOff className="h-5 w-5" /></button>
            </div>
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
              {callType === "video" && <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />}
              {callType === "audio" && <audio ref={remoteAudioRef} autoPlay />}
              {callType === "audio" && <div className="flex h-full items-center justify-center text-5xl text-(--gold-primary)">{remoteName.charAt(0).toUpperCase()}</div>}
              {callType === "video" && <video ref={localVideoRef} autoPlay muted playsInline className="absolute bottom-3 right-3 h-24 w-32 rounded-xl border border-white/20 bg-black object-cover" />}
            </div>
            {error && <p className="mt-3 text-center text-sm text-red-300">{error}</p>}
            <div className="mt-4 flex justify-center gap-3">
              <button type="button" onClick={() => { localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = muted; }); setMuted(!muted); }} className="rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label={muted ? "Unmute microphone" : "Mute microphone"} title={muted ? "Unmute microphone" : "Mute microphone"}>{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
              {callType === "video" && <button type="button" onClick={() => { localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = cameraOff; }); setCameraOff(!cameraOff); }} className="rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label={cameraOff ? "Turn camera on" : "Turn camera off"} title={cameraOff ? "Turn camera on" : "Turn camera off"}>{cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}</button>}
              <button type="button" onClick={hangUp} className="rounded-full bg-red-500 p-3 text-white hover:bg-red-600" aria-label="End call" title="End call"><PhoneOff className="h-5 w-5" /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
