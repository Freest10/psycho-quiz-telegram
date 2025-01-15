const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios'); // Для отправки HTTP-запросов

// Токен вашего основного бота (из переменных окружения)
const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = process.env.APP_URL; // URL вашего приложения (например, для Heroku)
const PORT = process.env.PORT || 3000;

// Токен второго бота, от имени которого будут отправляться уведомления, берётся из переменной окружения
const otherBotToken = process.env.OTHER_BOT_TOKEN;
// Массив chat_id получателей для уведомлений второго бота, берётся из переменной окружения и разделяется запятыми
const otherBotChatIds = process.env.OTHER_BOT_CHAT_IDS ? process.env.OTHER_BOT_CHAT_IDS.split(',') : [];

const app = express();
const webhookUrl = `${appUrl}/bot${token}`;

// Настройка основного бота
const bot = new TelegramBot(token, { webHook: true });
bot.setWebHook(webhookUrl);

// Middleware для обработки запросов от Telegram
app.use(bodyParser.json());
app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Объект для хранения состояния пользователей (в том числе сохранённого логина)
const userState = new Map();

const questions = [
    "Вы чувствуете, что ваша жизнь наполнена смыслом?",
    "Вы делаете то, что приносит вам удовольствие каждый день?",
    "У вас есть ясное понимание, чего вы хотите от жизни?",
    "Вы живёте в соответствии со своими ценностями?",
    "Вам легко отказаться от того, что не приносит радости?",
    "Вы часто чувствуете, что время проходит так, как вам хочется?",
    "У вас есть мечты и цели, которые вы активно реализуете?",
    "Вы не боитесь пробовать новое и выходить из зоны комфорта?",
    "Вы чувствуете себя хозяином своей жизни, а не жертвой обстоятельств?",
    "Вам нравится то, как вы проводите своё свободное время?",
    "Вы чувствуете, что ваши решения основаны на ваших желаниях, а не на ожиданиях других?",
    "У вас есть ощущение внутренней гармонии и удовлетворённости?",
    "Вы чувствуете, что развиваетесь как личность?",
    "Вам хватает времени, чтобы уделить внимание своим интересам и хобби?",
    "Вы можете сказать, что живёте в настоящем моменте, а не в прошлом или будущем?",
    "Вы часто испытываете вдохновение и энтузиазм?",
    "Вы легко принимаете решения, которые идут вам на пользу?",
    "Вы чувствуете, что контролируете свою жизнь, а не \u201cплывёте по течению\u201d?",
    "Вы не боитесь брать ответственность за свою жизнь?",
    "Вы ощущаете, что живёте именно так, как хотите?"
];

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    // Сохраняем логин (username) пользователя, если он есть
    userState.set(chatId, { currentQuestion: 0, answers: [], login: msg.from.username || msg.from.first_name });
    sendStartTestButton(chatId);
});

// При добавлении бота в чат также отправляем кнопку "Начать тест"
bot.on('my_chat_member', (msg) => {
    if (msg.new_chat_member && msg.new_chat_member.status === 'member') {
        const chatId = msg.chat.id;
        sendStartTestButton(chatId);
    }
});

// Отправка кнопки "Начать тест"
function sendStartTestButton(chatId) {
    const options = {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [
                    { text: 'Начать тест', callback_data: 'start_test' }
                ]
            ]
        })
    };

    bot.sendMessage(chatId,
        "Пройдите тест \u00abПроживаю ли я свою жизнь?\u00bb, чтобы глубже понять, насколько осознанно вы живёте свою жизнь, соответствуете ли своим целям и ценностям.\n" +
        "Ваши ответы помогут выявить сильные стороны и области для личного роста, а также направят вас на путь к более гармоничной и удовлетворённой жизни.\n\n" +
        "*Готовы начать? Нажмите \u00abНачать\u00bb и сделайте первый шаг к самопознанию!*",
        { parse_mode: 'Markdown', ...options }
    );
}

// Обработка нажатий на inline-кнопки (callback_query)
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'start_test') {
        // При запуске теста сохраняем логин, если вдруг его не было
        userState.set(chatId, { currentQuestion: 0, answers: [], login: callbackQuery.from.username || callbackQuery.from.first_name });
        bot.sendMessage(chatId, "Тест \"Проживаю ли я свою жизнь?\"\nОтвечайте на вопросы, нажимая кнопки \"Да\" или \"Нет\".")
            .then(() => {
                askNextQuestion(chatId);
            });
    } else {
        const state = userState.get(chatId);
        if (!state || state.currentQuestion >= questions.length) {
            return;
        }

        // Добавляем ответ: true, если пользователь выбрал "Да"
        state.answers.push(data === 'yes');
        state.currentQuestion++;

        if (state.currentQuestion < questions.length) {
            askNextQuestion(chatId);
        } else {
            // Когда тест завершён, передаём логин из состояния
            calculateResult(chatId, state.answers, state.login);
            userState.delete(chatId);
        }
    }
});

// Функция для отправки следующего вопроса
function askNextQuestion(chatId) {
    const state = userState.get(chatId);
    const question = questions[state.currentQuestion];

    const options = {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [
                    { text: 'Да', callback_data: 'yes' },
                    { text: 'Нет', callback_data: 'no' }
                ]
            ]
        })
    };

    bot.sendMessage(chatId, `Вопрос ${state.currentQuestion + 1}: ${question}`, options);
}

// Функция для подсчёта результата теста и отправки уведомления второму боту
function calculateResult(chatId, answers, login) {
    const yesCount = answers.filter(answer => answer).length;
    let result = "";

    if (yesCount >= 15) {
        result = "Вы проживаете свою жизнь осознанно и в соответствии с вашими желаниями.";
    } else if (yesCount >= 10) {
        result = "Вы стремитесь проживать свою жизнь, но иногда отклоняетесь от своего пути.";
    } else if (yesCount >= 5) {
        result = "Вы часто действуете под влиянием внешних обстоятельств и мало уделяете времени своим желаниям.";
    } else {
        result = "Вы, возможно, живёте чужими ожиданиями и упускаете возможность реализовать себя.";
    }

    // Отправляем результат теста пользователю
    bot.sendMessage(chatId, `Тест завершён!\n${result}`)
        .then(() => {
            // Дополнительное сообщение с фотографией
            return bot.sendPhoto(chatId, "https://raw.githubusercontent.com/Freest10/psycho-quiz-telegram/refs/heads/main/public/mosk.jpg", {
                caption: "24 февраля стартует мой авторский интенсив \"Перезагрузка: от апатии к счастью\", и я буду рада видеть вас.\n" +
                    "\n" +
                    "На нем вы сможете полностью выйти из состояния апатии и войдете в новую фазу своей жизни, осознанную и счастливую.\n" +
                    "Запись на сайте в лист ожидания дает скидку 15%."
            });
        })
        .catch(err => {
            console.error("Ошибка при отправке сообщений пользователю:", err);
        });

    // Отправка уведомления второму боту по массиву chat_id
    otherBotChatIds.forEach((destChatId) => {
        axios.post(`https://api.telegram.org/bot${otherBotToken}/sendMessage`, {
            chat_id: destChatId,
            text: `Пользователь ${login} прошёл тест.`
        })
            .then(response => {
                console.log(`Уведомление отправлено на ${destChatId}:`, response.data);
            })
            .catch(error => {
                console.error(`Ошибка при отправке уведомления на ${destChatId}:`, error.response?.data || error.message);
            });
    });
}
