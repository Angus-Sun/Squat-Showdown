const express = require("express");
const http = require("http");
const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = require("socket.io")(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const roomData = {};

io.on("connection", (socket) => {
    const generateRoomCode = () => {
        const characters = 'abcdefghijklmnopqrstuvwxyz';
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    };

    // Generate a room code for the new socket and store initial data
    const roomCode = generateRoomCode();
    socket.emit("me", roomCode);
    socket.join(roomCode);

    if (!roomData[roomCode]) {
        roomData[roomCode] = {
            mySquatCount: 0,
            userSquatCount: 0,
            playersReady: {} // Track readiness of players
        };
    }
    socket.on("playerReady", (roomCode) => {
        if (roomData[roomCode]) {
            socket.to(roomCode).emit("playerReady", socket.id);
            roomData[roomCode].playersReady[socket.id] = true;
            const allReady = Object.keys(roomData[roomCode].playersReady).length === 2 &&
                             Object.values(roomData[roomCode].playersReady).every(v => v === true);
            
            io.in(roomCode).emit("readyStateChanged", {
                allReady,
                mySquatCount: roomData[roomCode].mySquatCount,
                userSquatCount: roomData[roomCode].userSquatCount,
                playersReady: roomData[roomCode].playersReady
            });
        }
    });
    // Handle incoming squat count updates
    socket.on("updateMySquatCount", ({ count, roomCode }) => {
        console.log("aaaaa");
        if (roomData[roomCode]) {
            roomData[roomCode].mySquatCount = count;
            io.in(roomCode).emit("mysquatCountUpdated", {
                mySquatCount: roomData[roomCode].mySquatCount,
                roomCode
            });
        }
    });

    socket.on("updateUserSquatCount", ({ count, roomCode }) => {
        if (roomData[roomCode]) {
            roomData[roomCode].userSquatCount = count;
            io.in(roomCode).emit("usersquatCountUpdated", {
                userSquatCount: roomData[roomCode].userSquatCount,
                roomCode
            });
        }
    });

    // Handle user disconnection
    socket.on("disconnect", () => {
        for (const code in roomData) {
            if (io.sockets.adapter.rooms.get(code)?.has(socket.id)) {
                socket.leave(code);
                socket.broadcast.to(code).emit("callEnded");
                break;
            }
        }
    });

    // Handle calling another user
    socket.on("callUser", (data) => {
        const userToCallSocketId = io.sockets.adapter.rooms.get(data.userToCall)?.keys().next().value;
        if (userToCallSocketId) {
            io.to(userToCallSocketId).emit("callUser", {
                signal: data.signalData,
                from: data.from,
                name: data.name
            });
            socket.join(data.userToCall);
        }
    });

    // Handle joining a room
    socket.on("joinRoom", (roomCode) => {
        socket.join(roomCode);
        if (roomData[roomCode]) {
            socket.emit("squatCountUpdated", {
                mySquatCount: roomData[roomCode].mySquatCount,
                userSquatCount: roomData[roomCode].userSquatCount,
            });
        }
    });

    // Handle answering a call
    socket.on("answerCall", (data) => {
        const callerSocketId = io.sockets.adapter.rooms.get(data.to)?.keys().next().value;
        if (callerSocketId) {
            io.to(callerSocketId).emit("callAccepted", data.signal);
        }
    });
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
