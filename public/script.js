const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const socket = io();

const peerConnections = {}; // key: socketId, value: RTCPeerConnection
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let localStream;
const remoteAudioContainer = document.getElementById('remoteAudioContainer');

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

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit('answer', { to: from, answer });
});

socket.on('answer', async ({ from, answer }) => {
  const pc = peerConnections[from];
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
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
