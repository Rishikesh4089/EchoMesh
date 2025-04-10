const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const socket = io();

const peerConnections = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let isMuted = false;
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
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("Local stream obtained");

    socket.emit('join', roomId);
  } catch (err) {
    console.error('Error accessing microphone:', err);
  }
}

socket.on('all-users', async (users) => {
  console.log("All users in room:", users);
  for (const userId of users) {
    createPeerConnection(userId);
    const pc = peerConnections[userId];

    localStream.getTracks().forEach(track => {
      console.log(`Adding local track: ${track.kind}`);
      pc.addTrack(track, localStream);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit('offer', { to: userId, offer });
  }
});

socket.on('user-joined', (userId) => {
  console.log("New user joined:", userId);
  createPeerConnection(userId);
});

socket.on('offer', async ({ from, offer }) => {
  console.log("Received offer from", from);
  createPeerConnection(from);
  const pc = peerConnections[from];

  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  localStream.getTracks().forEach(track => {
    console.log(`Adding local track: ${track.kind}`);
    pc.addTrack(track, localStream);
  });

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', { to: from, answer });
});

socket.on('answer', async ({ from, answer }) => {
  const pc = peerConnections[from];
  console.log("Received answer from", from);
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async ({ from, candidate }) => {
  const pc = peerConnections[from];
  if (pc && candidate) {
    console.log("Adding ICE candidate from", from);
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
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
    console.log("Received remote track from", socketId);
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.srcObject = event.streams[0];
    remoteAudioContainer.appendChild(audio);
  };
}

joinRoom();
