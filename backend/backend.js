const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const axios    = require('axios');
const FormData = require('form-data');

const { getAccessToken, extractTopics } = require('./gigachat');

const app     = express();
const upload  = multer({ dest: 'voice_messages/' });

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

app.listen(3000, () => {
  console.log('Сервер слушает на http://localhost:3000');
});
