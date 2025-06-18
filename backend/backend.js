const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const axios    = require('axios');
const FormData = require('form-data');
const { Pool } = require('pg');

const { getAccessToken, extractTopics } = require('./gigachat');

const app     = express();
const upload  = multer({ dest: 'voice_messages/' });
app.use(express.json());

const pool = new Pool({
  user: 'tasks_user',
  host: '158.160.185.255',
  database: 'tasks_db',
  password: 'strongpassword',
  port: 5432,
});

app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const form = new FormData();
    form.append('audio', fs.createReadStream(req.file.path));

    const transcribeResponse = await axios.post(
      'http://whisper:5005/transcribe',
      form,
      { headers: form.getHeaders() }
    );

    const transcript = transcribeResponse.data.text;

    const accessToken = await getAccessToken();

    const summary = await extractTopics(accessToken, transcript);

    res.send({ transcript, summary });
  } catch (err) {
    console.error(err);
    res.status(500).send('Ошибка при обработке');
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

app.post('/register', async (req, res) => {
  const { user_name, password, telegram } = req.body;
  if (!user_name || !password) {
    return res.status(400).json({ error: 'Логин и пароль обязательны' });
  }

  try {
    const userCheck = await pool.query('SELECT 1 FROM users WHERE user_name = $1', [user_name]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Пользователь уже существует' });
    }

    let result;
    if (telegram) {
       result = await pool.query(
         'INSERT INTO users (user_name, password, telegram) VALUES ($1, $2, $3) RETURNING user_id',
       [user_name, password, telegram]
    );
    } else {
       result = await pool.query(
         'INSERT INTO users (user_name, password) VALUES ($1, $2) RETURNING user_id',
         [user_name, password]
       );
    }
    const newUserId = result.rows[0].user_id;
    return res.status(201).json({ status: 'created', user_id: newUserId });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/login', async (req, res) => {
  const { user_name, password } = req.body;
  if (!user_name || !password) {
    return res.status(400).json({ error: 'Логин и пароль обязательны' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE user_name = $1', [user_name]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const user = userResult.rows[0];

    if (user.password !== password) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    res.json({ message: 'Успешный вход', user_id: user.id });
  } catch (error) {
    console.error('Ошибка при логине:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/tasks', async (req, res) => {
  const { user_id, telegram_id, title, text, scheduled_at } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Заголовок задачи обязателен' });
  }

  let finalUserId = user_id;

  try {
    if (!finalUserId && telegram_id) {
      const result = await pool.query(
        'SELECT user_id FROM users WHERE telegram = $1',
        [telegram_id]
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: 'Пользователь с таким Telegram ID не найден' });
      }

      finalUserId = result.rows[0].user_id;
    }

    if (!finalUserId) {
      return res
        .status(400)
        .json({ error: 'Нужен либо user_id, либо telegram_id' });
    }

    let scheduledParam = null;
    if (scheduled_at) {
      const re =
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;
      if (!re.test(scheduled_at.trim())) {
        return res
          .status(400)
          .json({
            error:
              'Неверный формат scheduled_at. Используй YYYY-MM-DD HH:MM:SS',
          });
      }
      scheduledParam = scheduled_at.trim();
    }

    await pool.query(
      `INSERT INTO tasks
         (user_id, title, text, is_completed, scheduled_at, is_notified)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [finalUserId, title, text || null, false, scheduledParam, false]
    );

    res.status(201).json({ message: 'Задача добавлена' });
  } catch (error) {
    console.error('Ошибка при добавлении задачи:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/tasks', async (req, res) => {
  const { telegram_id } = req.query;
  try {
    const result = await pool.query('SELECT user_id FROM users WHERE telegram = $1', [telegram_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь с таким Telegram ID не найден' });
    }

    const id = result.rows[0].user_id;
    console.log(id, result.rows[0]);

    const these_tasks = await pool.query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY id DESC', [id]);
    res.json({ tasks: these_tasks.rows });
  } catch (error) {
    console.error('Ошибка при получении задач:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/tasks/mark_notified', async (req, res) => {
  const { id } = req.body;
  try {
    await pool.query('UPDATE tasks SET is_notified = true WHERE id = $1', [id]);
    res.status(200).json({ message: 'Задача отмечена как уведомлённая' });
  } catch (err) {
    console.error("Ошибка при обновлении задачи:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});


app.get('/due_tasks', async (req, res) => {
  const { telegram_id } = req.query;

  if (!telegram_id) {
    return res.status(400).json({ error: 'Нужно передать telegram_id' });
  }

  try {
    const userResult = await pool.query(
      'SELECT user_id FROM users WHERE telegram = $1',
      [telegram_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь с таким Telegram ID не найден' });
    }

    const user_id = userResult.rows[0].user_id;

    const tasksResult = await pool.query(`
      SELECT id, title, text, scheduled_at
      FROM tasks
      WHERE user_id = $1
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= NOW()
        AND tasks.is_notified = false
        ORDER BY scheduled_at ASC
    `, [user_id]);

    res.json({ tasks: tasksResult.rows });

  } catch (err) {
    console.error("Ошибка при получении задач:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});


app.get('/users_with_due_tasks', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT users.telegram
      FROM tasks
      JOIN users ON users.user_id = tasks.user_id
      WHERE tasks.scheduled_at IS NOT NULL
        AND tasks.scheduled_at <= NOW()
        AND users.telegram IS NOT NULL
    `);

    const telegram_ids = result.rows.map(r => r.telegram);
    res.json({ telegram_ids });

  } catch (err) {
    console.error("Ошибка при получении пользователей с задачами:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});


app.listen(3000, () => {
  console.log('Сервер слушает на http://localhost:3000');
});