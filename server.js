const usersInRoom = {};

io.on('connection', (socket) => {
  socket.on('join', (roomId) => {
    socket.join(roomId);

    if (!usersInRoom[roomId]) usersInRoom[roomId] = [];
    usersInRoom[roomId].push(socket.id);

    // Send list of other users in room to new user
    const otherUsers = usersInRoom[roomId].filter(id => id !== socket.id);
    socket.emit('all-users', otherUsers);
  });

  socket.on('offer', ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    for (const room in usersInRoom) {
      usersInRoom[room] = usersInRoom[room].filter(id => id !== socket.id);
    }
  });
});
