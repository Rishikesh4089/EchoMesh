const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const socket = io();

const peerConnections = {}; // key: socketId, value: RTCPeerConnection
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let localStream;
const remoteAudioContainer = document.getElementById('remoteAudioContainer');

document.getElementById('muteBtn').addEventListener('click', () => {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks()[0].enabled = !isMuted;
    document.getElementById('muteBtn').textContent = isMuted ? 'Unmute' : 'Mute';
  });
  
  document.getElementById('endCallBtn').addEventListener('click', () => {
    for (let id in peerConnections) {
      peerConnections[id]?.close();
    }
    socket.disconnect();
    window.location.href = 'join.html';
  });
  

async function joinRoom() {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  socket.emit('join', roomId);
}

socket.on('all-users', async (users) => {
  for (const userId of users) {
    createPeerConnection(userId);
    const pc = peerConnections[userId];

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit('offer', { to: userId, offer, roomId });
  }
});

socket.on('offer', async ({ from, offer }) => {
    createPeerConnection(from);
    const pc = peerConnections[from];
  
    if (pc.signalingState !== "stable") {
      console.warn('Skipping setRemoteDescription(offer) because signaling state is', pc.signalingState);
      return;
    }
  
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
  
    socket.emit('answer', { to: from, answer });
  });
  
  socket.on('answer', async ({ from, answer }) => {
    const pc = peerConnections[from];
  
    if (!pc.currentRemoteDescription && pc.signalingState === "have-local-offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } else {
      console.warn('Skipping setRemoteDescription(answer) — wrong state:', pc.signalingState);
    }
  });

socket.on('ice-candidate', ({ from, candidate }) => {
  const pc = peerConnections[from];
  if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate));
});

function createPeerConnection(socketId) {
  if (peerConnections[socketId]) return;

  const pc = new RTCPeerConnection(config);
  peerConnections[socketId] = pc;

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { to: socketId, candidate: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.srcObject = event.streams[0];
    remoteAudioContainer.appendChild(audio);
  };
}

joinRoom();
