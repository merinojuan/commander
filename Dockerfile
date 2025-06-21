FROM node:22.16.0-alpine

WORKDIR /app

COPY package*json tsconfig.json src ./

RUN npm ci && \
    npm run build && \
    npm prune --production

EXPOSE 3000

CMD ["node", "/app/dist/index.js"]