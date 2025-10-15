# Node.js 런타임 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# uploads 디렉토리 생성
RUN mkdir -p uploads

# 포트 노출
EXPOSE 9999

# 애플리케이션 실행
CMD ["npm", "start"]
