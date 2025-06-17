import json
import os
import telebot
import requests

API_TOKEN = "7967605608:AAG8yu92veB-eKFXryZqtJ0ne5EH48aR-ps"
bot = telebot.TeleBot(API_TOKEN)
BACKEND_URL = "http://localhost:3000/transcribe"

SAVE_DIR = 'voice_messages'

@bot.message_handler(commands=['start'])
def start_handler(message):
    bot.reply_to(
        message,
        f"Привет! Я родился!"
    )

@bot.message_handler(commands=['tasks'])
def start_handler(message):
    bot.reply_to(
        message,
        f"Здесь будут таски!"
    )


@bot.message_handler(content_types=['voice'])
def handle_voice(message):
    file_info = bot.get_file(message.voice.file_id)
    file_path = file_info.file_path
    file_url = f'https://api.telegram.org/file/bot{API_TOKEN}/{file_path}'

    response = requests.get(file_url)
    if response.status_code == 200:
        filename = f"{message.from_user.id}_{message.message_id}.ogg"
        with open(os.path.join(SAVE_DIR, filename), 'wb') as f:
            f.write(response.content)
        audio_path = os.path.join(SAVE_DIR, filename)
        
        with open(audio_path, 'rb') as audio_file:
            files = {'audio': (filename, audio_file, 'audio/ogg')}
            try:
                backend_response = requests.post(BACKEND_URL, files=files)
                
                if backend_response.status_code == 200:
                    data = backend_response.json()
                    bot.reply_to(message, f"Ответ от бэка: {json.dumps(data, ensure_ascii=False)}")
                else:
                    bot.reply_to(message, "Ошибка при расшифровке.")
            except Exception as e:
                bot.reply_to(message, f"Ошибка при соединении с бэкендом: {e}")
    else:
        bot.reply_to(message, "Ошибка при скачивании голосового.")

if __name__ == "__main__":
    bot.polling(none_stop=True)