# 실시간 PDF 뷰어

PDF.js와 WebSocket을 사용하여 실시간으로 PDF를 공유할 수 있는 웹 애플리케이션입니다.

## Demo

https://github.com/user-attachments/assets/03670358-7d36-493e-af82-b8f14db7cf77



## 기능

- **호스트 모드**: PDF 파일을 업로드하고 페이지를 제어
- **참가자 모드**: 실시간으로 호스트의 페이지 이동을 따라감
- **화질 저하 없음**: PDF.js를 사용하여 벡터 그래픽 그대로 렌더링
- **실시간 동기화**: WebSocket을 통한 즉각적인 페이지 동기화

## 설치 및 실행

### 로컬 개발 환경

1. 의존성 설치:
```bash
npm install
```

2. 서버 실행:
```bash
npm start
```

3. 브라우저에서 접속:
```
http://localhost:9999
```

### Docker를 사용한 배포

Docker와 Docker Compose를 사용하여 쉽게 배포할 수 있습니다.

1. **Docker Compose로 빌드 및 실행:**
```bash
docker-compose up -d
```

2. **특정 버전 빌드:**
```bash
docker-compose up --build -d
```

3. **로그 확인:**
```bash
docker-compose logs -f app
```

4. **중지 및 제거:**
```bash
docker-compose down
```

5. **볼륨 데이터 유지하면서 재시작:**
```bash
docker-compose down
docker-compose up -d
```

### Docker 명령어 (수동)

Docker Compose 대신 직접 Docker 명령어를 사용할 수도 있습니다:

```bash
# 이미지 빌드
docker build -t realtime-pdf-viewer .

# 컨테이너 실행 (uploads 볼륨 마운트)
docker run -d \
  --name realtime-pdf-viewer \
  -p 9999:9999 \
  -v $(pwd)/uploads:/app/uploads \
  realtime-pdf-viewer
```

## 사용법

### 호스트로 참여
1. "호스트로 참여" 버튼 클릭
2. PDF 파일을 드래그 앤 드롭하거나 선택
3. "업로드" 버튼 클릭
4. 페이지 컨트롤 버튼으로 슬라이드 제어

### 참가자로 참여
1. "참가자로 참여" 버튼 클릭
2. 호스트가 PDF를 업로드하면 자동으로 로드됨
3. 호스트의 페이지 이동을 실시간으로 따라감

## 기술 스택

- **Backend**: Node.js + Express
- **WebSocket**: ws 라이브러리
- **PDF 렌더링**: PDF.js
- **파일 업로드**: Multer
- **Frontend**: Vanilla JavaScript + HTML5 Canvas

## 프로젝트 구조

```
├── server.js          # 메인 서버 파일
├── package.json       # 의존성 설정
├── Dockerfile         # Docker 이미지 빌드 설정
├── docker-compose.yml # Docker Compose 설정
├── .dockerignore      # Docker 빌드 제외 파일 목록
├── public/
│   ├── index.html     # 메인 HTML 페이지
│   ├── js/
│   │   ├── viewer.js      # PDF 뷰어 클래스
│   │   └── websocket.js   # WebSocket 클라이언트
├── uploads/           # 업로드된 PDF 파일들 (Docker 볼륨 마운트)
└── README.md          # 이 파일
```

## 주요 파일 설명

### server.js
- Express 서버 설정
- WebSocket 서버 관리
- 파일 업로드 처리
- 클라이언트 상태 관리

### public/index.html
- 메인 UI 인터페이스
- 역할 선택 (호스트/참가자)
- PDF 업로드 인터페이스
- 페이지 컨트롤

### public/js/websocket.js
- WebSocket 연결 관리
- 자동 재연결 기능
- 메시지 송수신 처리

### public/js/viewer.js
- PDF.js를 활용한 PDF 렌더링
- 페이지 이동 및 확대/축소 기능

## API 엔드포인트

- `POST /upload`: PDF 파일 업로드
- `GET /current-pdf`: 현재 로드된 PDF 정보 조회
- `WebSocket ws://host:port`: 실시간 통신

## WebSocket 메시지 포맷

### 클라이언트 → 서버
```json
{
  "type": "join_as_host" | "join_as_viewer" | "page_change" | "get_current_state",
  "page": number (page_change 시)
}
```

### 서버 → 클라이언트
```json
{
  "type": "pdf_loaded" | "page_change",
  "pdf": { "filename": string, "originalName": string },
  "page": number
}
```

## 개발 모드

개발 중에는 다음 명령어로 서버를 실행하세요:
```bash
npm run dev
```

이렇게 하면 파일 변경 시 자동으로 서버가 재시작됩니다.

## 브라우저 지원

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 라이선스

MIT License
