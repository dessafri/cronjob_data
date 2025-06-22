const { io } = require("socket.io-client");

const socket = io("http://localhost:3000", {
  transports: ["polling", "websocket"]
});

socket.on("connect", () => {
  console.log("Connected with id:", socket.id);
  socket.disconnect();
});

socket.on("connect_error", (err) => {
  console.error("Connect error:", err.message);
});
