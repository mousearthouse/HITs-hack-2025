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
      'http://localhost:5005/transcribe',
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
  const { user_name, password } = req.body;
  if (!user_name || !password) {
    return res.status(400).json({ error: 'Логин и пароль обязательны' });
  }

  try {
    const userCheck = await pool.query('SELECT 1 FROM users WHERE user_name = $1', [user_name]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Пользователь уже существует' });
    }

    await pool.query('INSERT INTO users (user_name, password) VALUES ($1, $2)', [user_name, password]);
    res.status(201).json({ message: 'Пользователь зарегистрирован' });
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

    res.json({ message: 'Успешный вход' });
  } catch (error) {
    console.error('Ошибка при логине:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/tasks', async (req, res) => {
  const { user_id, title, text } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Заголовок задачи обязателен' });
  }

  try {
    await pool.query(
      'INSERT INTO tasks (user_id, title, text, is_completed) VALUES ($1, $2, $3, $4)',
      [user_id, title, text || null, false]
    );
    res.status(201).json({ message: 'Задача добавлена' });
  } catch (error) {
    console.error('Ошибка при добавлении задачи:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY id DESC');
    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Ошибка при получении задач:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


app.listen(3000, () => {
  console.log('Сервер слушает на http://localhost:3000');
});
