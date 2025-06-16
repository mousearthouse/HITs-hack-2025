const express = require('express');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const app = express();
const upload = multer({ dest: 'voice_messages/' });
const FormData = require('form-data');

app.post('/transcribe', upload.single('audio'), async (req, res) => {
    try {
        const form = new FormData();
        form.append('audio', fs.createReadStream(req.file.path));

        const response = await axios.post('http://localhost:5005/transcribe', form, {
            headers: form.getHeaders(),
        });

        res.send({ result: response.data.text });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка при транскрибации');
    } finally {
        fs.unlink(req.file.path, () => {});
    }
});

app.listen(3000, () => {
    console.log('Сервер слушает на http://localhost:3000');
});
