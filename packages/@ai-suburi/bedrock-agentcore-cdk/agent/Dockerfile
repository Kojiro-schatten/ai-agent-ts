FROM --platform=linux/arm64 node:20-slim

WORKDIR /app

# 依存関係を先にコピーしてキャッシュを活用
COPY package*.json ./
RUN npm install --production

# ソースコードをコピーしてビルド
COPY . .
RUN npx tsc

EXPOSE 8080

CMD ["node", "dist/index.js"]
