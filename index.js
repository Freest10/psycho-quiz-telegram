const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios'); // Для отправки HTTP-запросов
require('dotenv').config(); // Загрузка переменных окружения из .env

// Вывод переменных окружения для диагностики (НЕ ДЕЛАЙТЕ ЭТО В ПРОДАКШНЕ)
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '***' : 'Not Set');
console.log('APP_URL:', process.env.APP_URL);
console.log('OTHER_BOT_TOKEN:', process.env.OTHER_BOT_TOKEN ? '***' : 'Not Set');
console.log('OTHER_BOT_CHAT_IDS:', process.env.OTHER_BOT_CHAT_IDS);

// Проверка наличия необходимых переменных окружения
if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.APP_URL) {
    console.error("Ошибка: TELEGRAM_BOT_TOKEN и APP_URL должны быть установлены.");
    process.exit(1);
}

if (!process.env.OTHER_BOT_TOKEN || !process.env.OTHER_BOT_CHAT_IDS) {
    console.warn("Предупреждение: OTHER_BOT_TOKEN или OTHER_BOT_CHAT_IDS не установлены. Уведомления не будут отправляться.");
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = process.env.APP_URL; // URL вашего приложения (например, для Heroku)
const PORT = process.env.PORT || 3000;

// Токен второго бота, от имени которого будут отправляться уведомления
const otherBotToken = process.env.OTHER_BOT_TOKEN;
// Массив chat_id получателей (если переменная не задана, массив будет пустым)
const otherBotChatIds = process.env.OTHER_BOT_CHAT_IDS
    ? process.env.OTHER_BOT_CHAT_IDS.split(',').map(id => id.trim())
    : [];

const app = express();
const webhookUrl = `${appUrl}/bot${token}`;

// Настройка основного бота с режимом webhook
const bot = new TelegramBot(token, { webHook: true });

bot.setWebHook(webhookUrl)
    .then(() => {
        console.log(`Webhook установлен на ${webhookUrl}`);
    })
    .catch(err => {
        console.error("Ошибка при установке webhook:", err);
        process.exit(1);
    });

// Middleware для обработки запросов от Telegram
app.use(bodyParser.json());
app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body)
        .then(() => res.sendStatus(200))
        .catch(err => {
            console.error("Ошибка при обработке обновления:", err);
            res.sendStatus(500);
        });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Объект для хранения состояния пользователей
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
    const username = msg.from.username || msg.from.first_name || 'Неизвестный пользователь';
    console.log(`Получена команда /start от пользователя ${username} (Chat ID: ${chatId})`);
    userState.set(chatId, { currentQuestion: 0, answers: [], login: username });
    sendStartTestButton(chatId);
});

// Автоматический показ кнопки "Начать тест" при добавлении бота в чат
bot.on('my_chat_member', (msg) => {
    if (msg.new_chat_member && msg.new_chat_member.status === 'member') {
        const chatId = msg.chat.id;
        console.log(`Бот добавлен в чат ID: ${chatId}`);
        sendStartTestButton(chatId);
    }
});

// Отправка кнопки "Начать тест"
function sendStartTestButton(chatId) {
    const options = {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [{ text: 'Начать тест', callback_data: 'start_test' }]
            ]
        })
    };

    bot.sendMessage(chatId,
        "Пройдите тест \u00abПроживаю ли я свою жизнь?\u00bb, чтобы глубже понять, насколько осознанно вы живёте свою жизнь, соответствуете ли своим целям и ценностям.\n" +
        "Ваши ответы помогут выявить сильные стороны и области для личного роста, а также направят вас на путь к более гармоничной и удовлетворённой жизни.\n\n" +
        "*Готовы начать? Нажмите \u00abНачать\u00bb и сделайте первый шаг к самопознанию!*",
        { parse_mode: 'Markdown', ...options }
    )
        .then(() => {
            console.log(`Кнопка "Начать тест" отправлена в чат ID: ${chatId}`);
        })
        .catch(err => {
            console.error(`Ошибка при отправке кнопки "Начать тест" в чат ID ${chatId}:`, err);
        });
}

// Обработка нажатий на inline-кнопки (callback_query)
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const username = callbackQuery.from.username || callbackQuery.from.first_name || 'Неизвестный пользователь';
    console.log(`Получен callback_query от ${username} (Chat ID: ${chatId}): ${data}`);

    if (data === 'start_test') {
        // При запуске теста сохраняем login пользователя
        userState.set(chatId, { currentQuestion: 0, answers: [], login: username });
        bot.sendMessage(chatId, "Тест \"Проживаю ли я свою жизнь?\"\nОтвечайте на вопросы, нажимая кнопки \"Да\" или \"Нет\".")
            .then(() => {
                console.log(`Тест начат для пользователя ${username} (Chat ID: ${chatId})`);
                askNextQuestion(chatId);
            })
            .catch(err => {
                console.error(`Ошибка при отправке сообщения о начале теста пользователю ${username} (Chat ID: ${chatId}):`, err);
            });
    } else {
        const state = userState.get(chatId);
        if (!state) {
            console.warn(`Состояние пользователя не найдено для Chat ID: ${chatId}`);
            return;
        }

        if (state.currentQuestion >= questions.length) {
            console.warn(`Пользователь ${username} (Chat ID: ${chatId}) уже завершил тест.`);
            return;
        }

        // Сохраняем ответ: true, если пользователь выбрал "Да"
        const answer = data === 'yes';
        state.answers.push(answer);
        state.currentQuestion++;

        console.log(`Пользователь ${username} (Chat ID: ${chatId}) ответил "${answer ? 'Да' : 'Нет'}" на вопрос ${state.currentQuestion}`);

        if (state.currentQuestion < questions.length) {
            askNextQuestion(chatId);
        } else {
            // Тест завершён
            calculateResult(chatId, state.answers, state.login)
                .then(() => {
                    userState.delete(chatId);
                    console.log(`Тест завершён для пользователя ${username} (Chat ID: ${chatId})`);
                })
                .catch(err => {
                    console.error(`Ошибка при завершении теста для пользователя ${username} (Chat ID: ${chatId}):`, err);
                });
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

    bot.sendMessage(chatId, `Вопрос ${state.currentQuestion + 1}: ${question}`, options)
        .then(() => {
            console.log(`Вопрос ${state.currentQuestion + 1} отправлен в чат ID: ${chatId}`);
        })
        .catch(err => {
            console.error(`Ошибка при отправке вопроса в чат ID ${chatId}:`, err);
        });
}

// Подсчёт и отправка результата теста, плюс уведомление второму боту о логине пользователя
async function calculateResult(chatId, answers, login) {
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

    try {
        await bot.sendMessage(chatId, `Тест завершён!\n${result}`);
        console.log(`Результат отправлен пользователю ${login} (Chat ID: ${chatId})`);

        // Отправка дополнительного сообщения с фотографией
        await bot.sendPhoto(chatId, "https://raw.githubusercontent.com/Freest10/psycho-quiz-telegram/refs/heads/main/public/mosk.jpg", {
            caption: "24 февраля стартует мой авторский интенсив \"Перезагрузка: от апатии к счастью\", и я буду рада видеть вас.\n" +
                "\n" +
                "На нем вы сможете полностью выйти из состояния апатии и войдете в новую фазу своей жизни, осознанную и счастливую.\n" +
                "Запись на сайте в лист ожидания дает скидку 15%.",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Перейти на сайт", url: "https://annamoskpsy.tilda.ws/" }]
                ]
            }
        });
        console.log(`Фото отправлено пользователю ${login} (Chat ID: ${chatId})`);
    } catch (err) {
        console.error(`Ошибка при отправке результатов пользователю ${login} (Chat ID: ${chatId}):`, err);
    }

    // Проверка наличия необходимых переменных окружения
    if (!otherBotToken || otherBotChatIds.length === 0) {
        console.warn("OTHER_BOT_TOKEN или OTHER_BOT_CHAT_IDS не установлены. Уведомления не будут отправляться.");
        return;
    }

    // Отправка уведомлений второму боту по массиву chat_id
    otherBotChatIds.forEach(async (destChatId) => {
        try {
            const response = await axios.post(`https://api.telegram.org/bot${otherBotToken}/sendMessage`, {
                chat_id: destChatId,
                text: `Пользователь ${login} прошёл тест.`
            });
            console.log(`Уведомление отправлено на ${destChatId}:`, response.data);
        } catch (error) {
            if (error.response) {
                console.error(`Ошибка при отправке уведомления на ${destChatId}:`, error.response.data);
            } else {
                console.error(`Ошибка при отправке уведомления на ${destChatId}:`, error.message);
            }
        }
    });
}
