FROM python:3.11-slim

RUN apt-get update && apt-get install -y ffmpeg && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir flask
RUN pip install -U openai-whisper

COPY . .

EXPOSE 5005

CMD ["python", "transcribe.py"]
