FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir pyTelegramBotAPI requests

COPY . .

RUN mkdir -p voice_messages

ENV API_TOKEN="7967605608:AAG8yu92veB-eKFXryZqtJ0ne5EH48aR-ps"
ENV BACKEND_URL="http://backend:3000/transcribe"

CMD ["python", "bot.py"]
