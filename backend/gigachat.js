const fs      = require('fs');
const https   = require('https');
const axios   = require('axios');

const path = require('path')

process.env.NODE_EXTRA_CA_CERTS= path.resolve(__dirname, 'dir', 'with', 'certs')
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

async function getAccessToken () {

    const authKey = 'NzZmNzk5MTAtMDBlOS00ZDE3LWFmMDktZjhiMTg4MWE1Yzg4OjY1MjQ2MTBkLTA1MTAtNDc2ZC04Y2Y5LTUwODEyNTQ2NmE4MA=='; 
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await axios.post(
    'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
    { scope: 'GIGACHAT_API_PERS' },              // тело в JSON
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'Authorization': `Basic ${authKey}`,
                'RqUID': '76f79910-00e9-4d17-af09-f8b1881a5c88',
            },
            httpsAgent,                                // добавим ниже
        }
    );

  return response.data.access_token;
};

async function extractTopics (accessToken, text) {
  const { data } = await axios.post(
    'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
    {
      model: 'GigaChat:latest',
      messages: [
        {
          role: 'system',
          content: 'Ты – помощник‑секретарь. Получишь расшифровку голосового сообщения пользователя. ' +
                   'Выдели КРАТКИЙ список основных тем‑напоминалок (1–2 слова на каждую тему). ' +
                   'Верни только список через запятую, без лишнего текста.',
        },
        { role: 'user', content: text },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

module.exports = { getAccessToken, extractTopics };
