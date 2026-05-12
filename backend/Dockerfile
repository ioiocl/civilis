FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY tsconfig.json ./tsconfig.json

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && npm run dev"]
