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

// 현재 로드된 PDF 정보
let currentPdf = null;
let currentPage = 1;
let clients = new Map(); // clientId -> { ws, isHost, roomId }

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

// PDF 업로드 API
app.post("/upload", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "PDF 파일이 필요합니다." });
  }

  currentPdf = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: req.file.path,
    uploadedAt: new Date(),
  };
  currentPage = 1;

  // 모든 클라이언트에게 새 PDF 알림
  broadcastToAll({
    type: "pdf_loaded",
    pdf: {
      filename: currentPdf.filename,
      originalName: currentPdf.originalName,
    },
    page: currentPage,
  });

  res.json({
    success: true,
    pdf: {
      filename: currentPdf.filename,
      originalName: currentPdf.originalName,
    },
  });
});

// 현재 PDF 정보 조회 API
app.get("/current-pdf", (req, res) => {
  if (!currentPdf) {
    return res.status(404).json({ error: "로드된 PDF가 없습니다." });
  }

  res.json({
    filename: currentPdf.filename,
    originalName: currentPdf.originalName,
    page: currentPage,
  });
});

// WebSocket 연결 처리
wss.on("connection", (ws) => {
  const clientId = uuidv4();
  const client = { ws, isHost: false, roomId: "default" };
  clients.set(clientId, client);

  console.log(`새 클라이언트 연결: ${clientId}`);

  // 클라이언트에게 현재 상태 전송
  if (currentPdf) {
    ws.send(
      JSON.stringify({
        type: "pdf_loaded",
        pdf: {
          filename: currentPdf.filename,
          originalName: currentPdf.originalName,
        },
        page: currentPage,
      })
    );
  }

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(clientId, message);
    } catch (error) {
      console.error("메시지 파싱 오류:", error);
    }
  });

  ws.on("close", () => {
    console.log(`클라이언트 연결 종료: ${clientId}`);
    clients.delete(clientId);
  });

  ws.on("error", (error) => {
    console.error(`클라이언트 오류 ${clientId}:`, error);
    clients.delete(clientId);
  });
});

// 메시지 처리 함수
function handleMessage(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case "join_as_host":
      client.isHost = true;
      console.log(`호스트로 참여: ${clientId}`);
      break;

    case "join_as_viewer":
      client.isHost = false;
      console.log(`뷰어로 참여: ${clientId}`);
      break;

    case "page_change":
      if (client.isHost && currentPdf) {
        currentPage = message.page;
        console.log(`페이지 변경: ${currentPage} (호스트: ${clientId})`);

        // 모든 클라이언트에게 페이지 변경 알림 (호스트 제외)
        broadcastToViewers({
          type: "page_change",
          page: currentPage,
        });
      }
      break;

    case "get_current_state":
      if (currentPdf) {
        client.ws.send(
          JSON.stringify({
            type: "pdf_loaded",
            pdf: {
              filename: currentPdf.filename,
              originalName: currentPdf.originalName,
            },
            page: currentPage,
          })
        );
      }
      break;
  }
}

// 모든 클라이언트에게 브로드캐스트
function broadcastToAll(message) {
  const messageStr = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

// 뷰어들에게만 브로드캐스트
function broadcastToViewers(message) {
  const messageStr = JSON.stringify(message);
  clients.forEach((client) => {
    if (!client.isHost && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`http://localhost:${PORT} 에서 접속하세요.`);
});
