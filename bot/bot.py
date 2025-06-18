import json
import os
import telebot
import threading
import time
import requests
from datetime import datetime, timedelta, timezone
from telebot import types


API_TOKEN = "7967605608:AAG8yu92veB-eKFXryZqtJ0ne5EH48aR-ps"
bot = telebot.TeleBot(API_TOKEN)
BACKEND_URL = "http://158.160.185.255:3000"

SAVE_DIR = 'voice_messages'

@bot.message_handler(commands=['start'])
def start_handler(message):
    bot.reply_to(
        message,
        f"Привет! Зарегистрируйся по команде /register!"
    )

@bot.message_handler(commands=['tasks'])
def tasks_handler(message):
    user_id = message.from_user.id
    params = {"telegram_id": user_id}

    try:
        resp = requests.get(BACKEND_URL + "/tasks", params=params, timeout=5)
        if resp.status_code != 200:
            bot.reply_to(message, "⚠️ Не удалось получить задачи (статус {})."
                                   .format(resp.status_code))
            return

        tasks = resp.json().get("tasks", [])

        if not tasks:
            bot.reply_to(message, "У вас пока нет задач 👌")
            return

        lines = []
        for t in tasks:
            title = t.get("title", "Без названия")
            desc  = t.get("description") or t.get("text") or ""
            line  = f"• <b>{title}</b>"
            if desc:
                line += f"\n  {desc}"
            lines.append(line)

        reply_text = "📝 <b>Ваши задачи:</b>\n" + "\n\n".join(lines)
        bot.reply_to(message, reply_text, parse_mode="HTML")

    except requests.exceptions.RequestException as e:
        bot.reply_to(message, f"🚫 Ошибка соединения с бэкендом: {e}")

user_task_drafts = {}

@bot.message_handler(commands=['addtask'])
def addtask_start(message):
    bot.reply_to(message, "Как назвать задачу?")
    bot.register_next_step_handler(message, get_task_title)

def get_task_title(message):
    user_id = message.from_user.id
    user_task_drafts[user_id] = {"title": message.text}
    bot.reply_to(
        message,
        "Укажи дату и время напоминания в формате <b>дд.мм.гггг чч:мм</b>.\n"
        "Если напоминание не нужно — пришли точку «<code>.</code>».",
        parse_mode="HTML"
    )
    bot.register_next_step_handler(message, get_task_time)

def get_task_time(message):
    user_id = message.from_user.id
    text = message.text.strip()

    if text == ".":
        user_task_drafts[user_id]["scheduled_at"] = None
        bot.reply_to(message, "Теперь напиши описание задачи:")
        bot.register_next_step_handler(message, get_task_description)
        return

    try:
        
        local_dt = datetime.strptime(text, "%d.%m.%Y %H:%M")
        tz = timezone(timedelta(hours=7))
        localized_dt = local_dt.replace(tzinfo=tz)

        utc_dt = localized_dt.astimezone(timezone.utc)
        scheduled_str = utc_dt.strftime("%Y-%m-%d %H:%M:%S")

        user_task_drafts[user_id]["scheduled_at"] = scheduled_str

        bot.reply_to(message, "Отлично! Теперь напиши описание задачи:")
        bot.register_next_step_handler(message, get_task_description)

    except ValueError:
        bot.reply_to(
            message,
            "⏰ Неверный формат. Используй <b>дд.мм.гггг чч:мм</b> или «<code>.</code>», чтобы пропустить.",
            parse_mode="HTML"
        )
        bot.register_next_step_handler(message, get_task_time)

def get_task_description(message):
    user_id = message.from_user.id
    draft = user_task_drafts.get(user_id, {})
    draft["description"] = message.text

    payload = {
        "telegram_id": message.from_user.id,
        "title": draft["title"],
        "text": draft["description"]
    }
    if draft.get("scheduled_at"):
        payload["scheduled_at"] = draft["scheduled_at"]

    print("📦 Payload, который отправляется на бэкенд:", payload)

    try:
        resp = requests.post(BACKEND_URL + "/tasks", json=payload, timeout=5)
        if resp.status_code == 201:
            bot.reply_to(message, "✅ Задача успешно добавлена!")
        else:
            bot.reply_to(message, f"❌ Ошибка при добавлении: {resp.status_code}, {resp.text}")
    except Exception as e:
        bot.reply_to(message, f"🚫 Ошибка при соединении с сервером: {e}")

    user_task_drafts.pop(user_id, None)


user_registration_drafts = {}

@bot.message_handler(commands=['register'])
def register_start(message):
    bot.reply_to(message, "Введите логин:")
    bot.register_next_step_handler(message, get_register_username)

def get_register_username(message):
    user_id = message.from_user.id
    user_registration_drafts[user_id] = {"user_name": message.text}
    bot.reply_to(message, "Введите пароль:")
    bot.register_next_step_handler(message, get_register_password)

def get_register_password(message):
    user_id = message.from_user.id
    draft = user_registration_drafts.get(user_id, {})
    draft["password"] = message.text
    draft["telegram"] = str(user_id)

    try:
        resp = requests.post(BACKEND_URL + "/register", json=draft, timeout=5)
        print("Ответ от бэка:", resp.status_code, resp.text)
        if resp.status_code == 201:
            bot.reply_to(message, "✅ Вы успешно зарегистрированы!")
        elif resp.status_code == 409:
            bot.reply_to(message, "⚠️ Пользователь с таким логином уже существует.")
        else:
            bot.reply_to(message, f"❌ Ошибка регистрации: {resp.status_code}, {resp.text}")
    except Exception as e:
        print(f"🚫 Ошибка при соединении с сервером: {e}")

    user_registration_drafts.pop(user_id, None)


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
                backend_response = requests.post(BACKEND_URL + "/transcribe", files=files)

                if backend_response.status_code == 200:
                    data = backend_response.json()
                    transcript = data.get("transcript", "Нет расшифровки")
                    summary = data.get("summary", "Нет саммари")

                    reply_text = (f"Расшифровка: {transcript}\n"
                                  f"Возможные названия напоминалки: {summary}")
                    bot.reply_to(message, reply_text)
                else:
                    bot.reply_to(message, "Ошибка при расшифровке.")
            except Exception as e:
                bot.reply_to(message, f"Ошибка при соединении с бэкендом: {e}")
    else:
        bot.reply_to(message, "Ошибка при скачивании голосового.")


CHECK_INTERVAL = 60

def check_tasks_loop():
    while True:
        try:
            resp_users = requests.get(BACKEND_URL + "/users_with_due_tasks", timeout=5)
            if resp_users.status_code != 200:
                print(f"⚠️ Ошибка при получении пользователей: {resp_users.status_code}")
                time.sleep(CHECK_INTERVAL)
                continue

            telegram_ids = resp_users.json().get("telegram_ids", [])

            now_utc = datetime.now(timezone.utc)

            for telegram_id in telegram_ids:
                try:
                    resp = requests.get(
                        BACKEND_URL + "/due_tasks",
                        params={"telegram_id": telegram_id},
                        timeout=5
                    )
                    if resp.status_code == 200:
                        tasks = resp.json().get("tasks", [])
                        for task in tasks:
                            title = task["title"]
                            scheduled_str = task["scheduled_at"] 

                            scheduled_utc = datetime.fromisoformat(scheduled_str).replace(tzinfo=timezone.utc)

                            if scheduled_utc <= now_utc:
                                scheduled_local = scheduled_utc.astimezone(timezone(timedelta(hours=7)))
                                scheduled_local_str = scheduled_local.strftime("%d.%m.%Y %H:%M")

                                bot.send_message(
                                    telegram_id,
                                    f"🔔 Напоминание: {title}\n🕐 {scheduled_local_str}"
                                )

                                requests.post(
                                    BACKEND_URL + "/tasks/mark_notified",
                                    json={"id": task["id"]},
                                    timeout=5
                                )

                    else:
                        print(f"⚠️ Ошибка при получении задач для {telegram_id}: {resp.status_code}")

                except Exception as inner_e:
                    print(f"❌ Ошибка при работе с пользователем {telegram_id}: {inner_e}")

        except Exception as e:
            print(f"❌ Ошибка в общем фоновом процессе: {e}")

        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    threading.Thread(target=check_tasks_loop, daemon=True).start()
    bot.polling(none_stop=True)