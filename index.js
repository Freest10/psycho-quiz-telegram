const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const botNumber = 1; // Увеличивать на 1 для последующих ботов
const renderProjectUrl = 'https://psycho-quiz-telegram.onrender.com'; // Указать урл проекта на render

const app = express();
const webhookUrl = `${renderProjectUrl}/bot${botNumber}/${token}`;

// const webhookUrl = `https://${process.env.RENDER_EXTERNAL_URL}/bot${token}`;
const PORT = process.env.PORT || 3000;

// Настройка бота
const bot = new TelegramBot(token, { webHook: true });
bot.setWebHook(webhookUrl);

// Middleware для обработки запросов Telegram
app.use(bodyParser.json());
app.post(`/bot${botNumber}/${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Переменная для хранения состояния пользователей
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
    "Вы чувствуете, что контролируете свою жизнь, а не “плывёте по течению”?",
    "Вы не боитесь брать ответственность за свою жизнь?",
    "Вы ощущаете, что живёте именно так, как хотите?"
];

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    sendStartTestButton(chatId);
});

// Автоматический показ кнопки "Начать тест" при добавлении бота
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
        "Пройдите тест «Проживаю ли я свою жизнь?», чтобы глубже понять, насколько осознанно вы живёте свою жизнь, соответствуете ли своим целям и ценностям.\n" +
        "Ваши ответы помогут выявить сильные стороны и области для личного роста, а также направят вас на путь к более гармоничной и удовлетворённой жизни.\n\n" +
        "*Готовы начать? Нажмите «Начать» и сделайте первый шаг к самопознанию!*",
        { parse_mode: 'Markdown', ...options }
    );
}

// Обработка начала теста по кнопке
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'start_test') {
        userState.set(chatId, { currentQuestion: 0, answers: [] });
        bot.sendMessage(chatId, "Тест \"Проживаю ли я свою жизнь?\"\nОтвечайте на вопросы, нажимая кнопки \"Да\" или \"Нет\".");
        askNextQuestion(chatId);
    } else {
        const state = userState.get(chatId);

        if (!state || state.currentQuestion >= questions.length) {
            return;
        }

        state.answers.push(data === 'yes');
        state.currentQuestion++;

        if (state.currentQuestion < questions.length) {
            askNextQuestion(chatId);
        } else {
            calculateResult(chatId, state.answers);
            userState.delete(chatId);
        }
    }
});

// Задаёт следующий вопрос с кнопками
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

// Подсчёт и отправка результата
function calculateResult(chatId, answers) {
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

    bot.sendMessage(chatId, `Тест завершён!\n${result}`).then(() => {
        // Отправляем дополнительное сообщение с кнопками
        bot.sendMessage(chatId, "Хотите узнать, как можно сделать свою жизнь ещё лучше? Нажмите на кнопку ниже, чтобы получить дополнительную информацию!", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Посмотреть видео", url: "https://youtu.be/jMCJSSDkujA?si=wzjbz6CzYoHajfl1" }],
                ]
            }
        });
    }).catch(err => {
        console.error("Ошибка при отправке сообщений:", err);
    });
}
