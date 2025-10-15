class WebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 9999;
    this.isConnected = false;
  }

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error("WebSocket 연결 실패:", error);
      this.handleReconnect();
    }
  }

  setupEventHandlers() {
    this.ws.onopen = (event) => {
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // 연결 상태 표시
      this.updateConnectionStatus("연결됨");
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error("메시지 파싱 오류:", error);
      }
    };

    this.ws.onclose = (event) => {
      this.isConnected = false;
      this.updateConnectionStatus("연결 끊어짐");

      if (event.code !== 1000) {
        // 정상 종료가 아닌 경우 재연결 시도
        this.handleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket 오류:", error);
      this.isConnected = false;
      this.updateConnectionStatus("연결 오류");
    };
  }

  handleMessage(message) {
    switch (message.type) {
      case "room_joined":
        // 방 참여 성공 이벤트 발생
        window.dispatchEvent(
          new CustomEvent("room_joined", {
            detail: message,
          })
        );
        break;

      case "error":
        // 에러 이벤트 발생
        window.dispatchEvent(
          new CustomEvent("room_error", {
            detail: message,
          })
        );
        break;

      case "pdf_loaded":
        // PDF 로드 이벤트 발생
        window.dispatchEvent(
          new CustomEvent("pdf_loaded", {
            detail: message,
          })
        );
        break;

      case "page_change":
        // 페이지 변경 이벤트 발생
        window.dispatchEvent(
          new CustomEvent("page_change", {
            detail: message,
          })
        );
        break;

      default:
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket이 연결되지 않아 메시지를 보낼 수 없습니다.");
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.updateConnectionStatus(
        `재연결 시도 중... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      this.updateConnectionStatus("연결 실패 - 페이지를 새로고침 해주세요");
    }
  }

  updateConnectionStatus(status) {
    const statusElement = document.getElementById("status");
    if (statusElement) {
      const currentText = statusElement.textContent;
      const roleText = currentText.includes("호스트")
        ? "호스트"
        : currentText.includes("참가자")
        ? "참가자"
        : "";

      if (roleText) {
        statusElement.textContent = `${roleText}로 참여 중 - ${status}`;
      } else {
        statusElement.textContent = status;
      }
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, "클라이언트 종료");
    }
  }
}

// 전역 WebSocket 클라이언트 인스턴스 생성
window.wsClient = new WebSocketClient();

// 페이지 로드 시 자동 연결
document.addEventListener("DOMContentLoaded", () => {
  window.wsClient.connect();
});

// 페이지 언로드 시 연결 종료
window.addEventListener("beforeunload", () => {
  window.wsClient.disconnect();
});
