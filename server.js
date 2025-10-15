const express = require("express");
const WebSocket = require("ws");
const http = require("http");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 방별 상태 관리
let rooms = new Map();
let clients = new Map();

// 방 생성 함수
function createRoom(roomId, privacy = "public", password = null) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      pdf: null,
      page: 1,
      clients: new Set(),
      privacy: privacy, // 'public' or 'private'
      password: password, // 비밀번호 (private 방인 경우)
      createdAt: new Date(),
    });
  }
  return rooms.get(roomId);
}

// 방 삭제 함수
function deleteRoom(roomId) {
  if (rooms.has(roomId)) {
    const room = rooms.get(roomId);
    if (room.clients.size === 0) {
      rooms.delete(roomId);
    }
  }
}

// 업로드 디렉토리 생성
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// 정적 파일 제공
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("PDF 파일만 업로드 가능합니다."));
    }
  },
});

// 방 목록 조회 API
app.get("/rooms", (req, res) => {
  const roomList = [];
  rooms.forEach((room, roomId) => {
    roomList.push({
      roomId: roomId,
      privacy: room.privacy,
      clientCount: room.clients.size,
      hasPdf: room.pdf !== null,
      createdAt: room.createdAt,
    });
  });

  // 생성 시간 기준 내림차순 정렬
  roomList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({
    success: true,
    rooms: roomList,
  });
});

// PDF 업로드 API
app.post("/upload", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "PDF 파일이 필요합니다." });
  }

  const pdfInfo = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: req.file.path,
    uploadedAt: new Date(),
  };

  res.json({
    success: true,
    pdf: {
      filename: pdfInfo.filename,
      originalName: pdfInfo.originalName,
    },
  });
});

// WebSocket 연결 처리
wss.on("connection", (ws) => {
  const clientId = uuidv4();
  const client = { ws, isHost: false, roomId: null };
  clients.set(clientId, client);

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(clientId, message);
    } catch (error) {
      console.error("메시지 파싱 오류:", error);
    }
  });

  ws.on("close", () => {
    // 방에서 클라이언트 제거
    const client = clients.get(clientId);
    if (client && client.roomId) {
      const room = rooms.get(client.roomId);
      if (room) {
        room.clients.delete(clientId);
        // 방에 클라이언트가 없으면 방 삭제
        if (room.clients.size === 0) {
          deleteRoom(client.roomId);
        }
      }
    }

    clients.delete(clientId);
  });

  ws.on("error", (error) => {
    console.error(`클라이언트 오류 ${clientId}:`, error);

    // 방에서 클라이언트 제거
    const client = clients.get(clientId);
    if (client && client.roomId) {
      const room = rooms.get(client.roomId);
      if (room) {
        room.clients.delete(clientId);
        // 방에 클라이언트가 없으면 방 삭제
        if (room.clients.size === 0) {
          deleteRoom(client.roomId);
        }
      }
    }

    clients.delete(clientId);
  });
});

// 메시지 처리 함수
function handleMessage(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case "create_room":
      if (!message.roomId || !/^[a-zA-Z0-9]+$/.test(message.roomId)) {
        client.ws.send(
          JSON.stringify({
            type: "error",
            message: "방 이름은 영어와 숫자로만 구성되어야 합니다.",
          })
        );
        return;
      }

      // 중복 방 이름 검증
      if (rooms.has(message.roomId)) {
        client.ws.send(
          JSON.stringify({
            type: "error",
            message: "이미 존재하는 방 이름입니다.",
          })
        );
        return;
      }

      // privacy 설정 검증
      const privacy = message.privacy || "public";
      if (!["public", "private"].includes(privacy)) {
        client.ws.send(
          JSON.stringify({
            type: "error",
            message: "잘못된 방 공개 설정입니다.",
          })
        );
        return;
      }

      // private 방인 경우 비밀번호 검증
      let password = null;
      if (privacy === "private") {
        if (!message.password || message.password.trim().length === 0) {
          client.ws.send(
            JSON.stringify({
              type: "error",
              message: "비공개 방에는 비밀번호가 필요합니다.",
            })
          );
          return;
        }
        password = message.password.trim();
      }

      const room = createRoom(message.roomId, privacy, password);
      client.roomId = message.roomId;
      client.isHost = true;
      room.clients.add(clientId);

      // 방 생성 성공 응답
      client.ws.send(
        JSON.stringify({
          type: "room_joined",
          roomId: message.roomId,
          isHost: true,
          privacy: privacy,
        })
      );

      // 현재 방 상태 전송
      if (room.pdf) {
        client.ws.send(
          JSON.stringify({
            type: "pdf_loaded",
            pdf: {
              filename: room.pdf.filename,
              originalName: room.pdf.originalName,
            },
            page: room.page,
          })
        );
      }
      break;

    case "join_room":
      if (!message.roomId || !/^[a-zA-Z0-9]+$/.test(message.roomId)) {
        client.ws.send(
          JSON.stringify({
            type: "error",
            message: "방 이름은 영어와 숫자로만 구성되어야 합니다.",
          })
        );
        return;
      }

      const joinRoom = rooms.get(message.roomId);
      if (!joinRoom) {
        client.ws.send(
          JSON.stringify({
            type: "error",
            message: "존재하지 않는 방입니다.",
          })
        );
        return;
      }

      // private 방인 경우 비밀번호 검증
      if (joinRoom.privacy === "private") {
        if (
          !message.password ||
          message.password.trim() !== joinRoom.password
        ) {
          client.ws.send(
            JSON.stringify({
              type: "error",
              message: "비밀번호가 일치하지 않습니다.",
            })
          );
          return;
        }
      }

      client.roomId = message.roomId;
      client.isHost = false;
      joinRoom.clients.add(clientId);

      // 방 참여 성공 응답
      client.ws.send(
        JSON.stringify({
          type: "room_joined",
          roomId: message.roomId,
          isHost: false,
          privacy: joinRoom.privacy,
        })
      );

      // 현재 방 상태 전송
      if (joinRoom.pdf) {
        client.ws.send(
          JSON.stringify({
            type: "pdf_loaded",
            pdf: {
              filename: joinRoom.pdf.filename,
              originalName: joinRoom.pdf.originalName,
            },
            page: joinRoom.page,
          })
        );
      }
      break;

    case "upload_pdf":
      if (!client.roomId || !client.isHost) {
        client.ws.send(
          JSON.stringify({
            type: "error",
            message: "호스트만 PDF를 업로드할 수 있습니다.",
          })
        );
        return;
      }

      const roomForUpload = rooms.get(client.roomId);
      if (roomForUpload) {
        roomForUpload.pdf = message.pdf;
        roomForUpload.page = 1;

        // 같은 방의 모든 클라이언트에게 PDF 로드 알림
        broadcastToRoom(client.roomId, {
          type: "pdf_loaded",
          pdf: message.pdf,
          page: 1,
        });
      }
      break;

    case "page_change":
      if (!client.roomId || !client.isHost) return;

      const roomForPageChange = rooms.get(client.roomId);
      if (roomForPageChange && roomForPageChange.pdf) {
        roomForPageChange.page = message.page;

        // 같은 방의 뷰어들에게만 페이지 변경 알림
        broadcastToRoomViewers(client.roomId, {
          type: "page_change",
          page: message.page,
        });
      }
      break;
  }
}

// 방의 모든 클라이언트에게 브로드캐스트
function broadcastToRoom(roomId, message) {
  const room = rooms.get(roomId);
  if (!room) return;

  const messageStr = JSON.stringify(message);
  room.clients.forEach((clientId) => {
    const client = clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

// 방의 뷰어들에게만 브로드캐스트
function broadcastToRoomViewers(roomId, message) {
  const room = rooms.get(roomId);
  if (!room) return;

  const messageStr = JSON.stringify(message);
  room.clients.forEach((clientId) => {
    const client = clients.get(clientId);
    if (client && !client.isHost && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

const PORT = process.env.PORT || 9999;
server.listen(PORT, () => {});
