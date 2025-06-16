FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN mkdir -p voice_messages

EXPOSE 3000

CMD ["node", "backend.js"]
