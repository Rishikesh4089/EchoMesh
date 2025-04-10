const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const socket = io();

let peerConnection;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const remoteAudio = document.getElementById('remoteAudio');

if (roomId) joinRoom();

async function joinRoom() {
  socket.emit('join', roomId);

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  peerConnection = new RTCPeerConnection(config);

  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { roomId, candidate: event.candidate });
    }
  };

  peerConnection.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
  };

  socket.on('user-joined', async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { roomId, offer });
  });

  socket.on('offer', async (offer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { roomId, answer });
  });

  socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  });

  socket.on('ice-candidate', async (candidate) => {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Error adding ICE candidate', e);
    }
  });
}
