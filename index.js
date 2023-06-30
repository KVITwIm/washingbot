require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { message } = require('telegraf/filters');
const mongoose = require('mongoose');
const bot = new Telegraf(process.env.BOT_TOKEN);
const dayjs = require('dayjs');
const { name } = require('dayjs/locale/ru');
require('dayjs/locale/ru')
dayjs.locale('ru')

const passwordMongoAtlas = process.env['passwordMongoAtlas']

mongoose.connect(`mongodb+srv://admin:${passwordMongoAtlas}@washingtech.92gfp9u.mongodb.net/washingtech?retryWrites=true&w=majority`);

let items = []
let user = ''
let unsignStatus = false
let signStatusToday = false
let signStatusTomorrow = false
let unsignData = []

let washingSchema = new mongoose.Schema({
    name: String,
    username: String,
    startTime: String,
    endTime: String
}, {
    timestamps: true
});

let Washing = mongoose.model('sign', washingSchema);

bot.start((ctx) => {
    ctx.deleteMessage()

    unsignStatus = false
    signStatus = false

    let startKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Записаться', 'sign'), Markup.button.callback('Отменить запись', 'unsign')],
        [Markup.button.callback('Просмотреть записи', 'watch')],
    ]);

    ctx.replyWithHTML('Выберите действие:', startKeyboard)

    user = ctx.message.from.username;
    chatId = ctx.message.chat.id
});

bot.action('cancel', (ctx) => {
    ctx.deleteMessage()

    unsignData[0] = false
    signStatus = false


    let startKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Записаться', 'sign'), Markup.button.callback('Отменить запись', 'unsign')],
        [Markup.button.callback('Просмотреть записи', 'watch')],
    ]);

    ctx.replyWithHTML('Выберите действие:', startKeyboard)
});

bot.action('unsign', async (ctx) => {
    ctx.deleteMessage()
    let signs = await Washing.find({ username: ctx.callbackQuery.message.chat.username }).sort({ startTime: 1 })
    let text = ``
    for (let i = 0; i < signs.length; i++) {
        text += `${i + 1}. ${dayjs(signs[i].startTime).format('DD.MM')}: ${dayjs(signs[i].startTime).format('HH:mm')} - ${dayjs(signs[i].endTime).format('HH:mm')}\n`
    }
    ctx.replyWithHTML(`Ваши записи:\n${text}\nНапишите номер, чтобы отменить. (пример: 1)`, Markup.inlineKeyboard([[Markup.button.callback('Назад', 'cancel')]]))

    unsignStatus = true
    unsignData = [unsignStatus, signs, ctx.callbackQuery.message.message_id, ctx.callbackQuery.message.chat.id]
    return unsignData
})

bot.action('watch', async (ctx) => {
    ctx.deleteMessage()
    let signs = await Washing.find().sort({ startTime: 1 });
    let signsToday = ``
    let signsTomorrow = ``

    for (let i = 0; i < signs.length; i++) {
        if (dayjs(signs[i].startTime).date() == dayjs().date()) {
            signsToday += `${(signs[i].name)}: ${dayjs(signs[i].startTime).format('HH:mm')}-${dayjs(signs[i].endTime).format('HH:mm')}\n`
        } else if (dayjs(signs[i].startTime).date() == dayjs().date(dayjs().date() + 1).date()) {
            signsTomorrow += `${(signs[i].name)}: ${dayjs(signs[i].startTime).format('HH:mm')}-${dayjs(signs[i].endTime).format('HH:mm')}\n`
        } else if (dayjs(signs[i].startTime).date() < dayjs().date()) {
            await signs[i].deleteOne()
        }
    }
    if (signsToday == ``) {
        signsToday = "Нет записей \n"
    }
    if (signsTomorrow == ``) {
        signsTomorrow = "Нет записей \n"
    }

    ctx.replyWithHTML(`Забронированное время\nСегодня (${dayjs().format('DD.MM')}):\n${signsToday}\nЗавтра (${dayjs().date(dayjs().date() + 1).format('DD.MM')}):\n${signsTomorrow}`, Markup.inlineKeyboard([[Markup.button.callback('Назад', 'cancel')]]))
});

bot.action('sign', (ctx) => {
    ctx.deleteMessage()
    signStatusToday = false;
    ctx.reply("Выберите дату", Markup.inlineKeyboard([
        [Markup.button.callback('Сегодня', 'today'),
        Markup.button.callback('Завтра', 'tomorrow'),
        Markup.button.callback('Назад', 'cancel')]
    ]));
    return signStatusToday
})

bot.action('today', (ctx) => {
    ctx.deleteMessage()
    ctx.reply("Напишите время (пример: 18:00 - 19:00)", Markup.inlineKeyboard([[Markup.button.callback('Назад', 'sign')]]));

    signStatusToday = true;
    return signStatusToday
})

bot.action('tomorrow', (ctx) => {
    ctx.deleteMessage()
    ctx.reply("Напишите время (пример: 18:00 - 19:00)", Markup.inlineKeyboard([[Markup.button.callback('Назад', 'sign')]]));
    signStatusTomorrow = true
    return signStatusTomorrow
})

bot.on(message("text"), async (ctx) => {
    if (unsignData[0]) {
        let signs = unsignData[1]
        let userText = ctx.message.text
        if (isNaN(userText)) {
            ctx.reply("Вы ввели не число.")
        } else if (signs[Number(userText) - 1]) {
            await Washing.deleteOne({ _id: signs[[Number(userText) - 1]]._id })
            ctx.reply(`Запись ${dayjs(signs[Number(userText) - 1].startTime).format('DD.MM')}: ${dayjs(signs[Number(userText) - 1].startTime).format('HH:mm')} - ${dayjs(signs[Number(userText) - 1].endTime).format('HH:mm')} удалена`, Markup.inlineKeyboard([[Markup.button.callback('Назад', 'cancel')]]))
        } else {
            ctx.reply("Данной записи не существует.")
        }
    } else if (signStatusToday) {
        ctx.deleteMessage()
        if (ctx.message.text.indexOf('-') == -1) {
            ctx.reply(`Неверный формат. (пример: 15:00 - 16:00)`)
            return
        }

        let userTime = ctx.message.text.split('-')
        let firstNumber = userTime[0].trim()
        let secondNumber = userTime[1].trim()

        let firstNumberSlice = firstNumber.split(':')
        let firstNumber1 = firstNumberSlice[0]
        let firstNumber2 = firstNumberSlice[1]

        let secondNumberSlice = secondNumber.split(':')
        let secondNumber1 = secondNumberSlice[0]
        let secondNumber2 = secondNumberSlice[1]

        if (23 < secondNumber1 || secondNumber1 < 0 || 59 < secondNumber2 || secondNumber2 < 0 || 23 < firstNumber1 || firstNumber1 < 0 || 59 < firstNumber2 || firstNumber2 < 0) {
            ctx.reply(`Неверный формат. (пример: 15:00 - 16:00)`)
            return
        }

        let firstDate = dayjs().minute(firstNumber2).hour(firstNumber1).second(0).format()
        let secondDate = dayjs().minute(secondNumber2).hour(secondNumber1).second(0).format()

        if (firstDate > secondDate) {
            ctx.reply(`Неверный формат. (пример: 15:00 - 16:00)`)
            return
        }

        let signs = await Washing.find().sort({ startTime: 1 })
        let wrong = 0;

        for (let i = 0; i < signs.length; i++) {
            if (dayjs(signs[i].startTime).format() < firstDate && dayjs(signs[i].endTime).format() > firstDate) {
                ctx.reply(`Данное время уже занято, выберите другое.`)
                wrong++
                return
            } else if (dayjs(signs[i].startTime).format() <= secondDate && dayjs(signs[i].endTime).format() >= secondDate) {
                ctx.reply(`Данное время уже занято, выберите другое.`)
                wrong++
                return
            } else if (dayjs(signs[i].startTime).format() >= firstDate && dayjs(signs[i].endTime).format() <= secondDate) {
                ctx.reply(`Данное время уже занято, выберите другое.`)
                wrong++
                return
            } else if (dayjs(signs[i].startTime).format() <= firstDate && dayjs(signs[i].endTime).format() <= secondDate && firstDate < dayjs(signs[i].endTime).format()) {
                ctx.reply(`Данное время уже занято, выберите другое.`)
                wrong++
                return
            } else if (dayjs(signs[i].startTime).format() <= firstDate && dayjs(signs[i].endTime).format() >= secondDate) {
                ctx.reply(`Данное время уже занято, выберите другое.`)
                wrong++
                return
            }
        }

        if (wrong > 0) {
            return
        }

        let name = ctx.message.from.first_name
        let username = ctx.message.from.username

        ctx.reply(`Ваше время: ${firstNumber} - ${secondNumber}`, Markup.inlineKeyboard([[Markup.button.callback('Подтвердить', 'save')], [Markup.button.callback('Назад', 'today')]]))

        items = [name, username, firstDate, secondDate, firstNumber, secondNumber]
        return items
    } else if (signStatusTomorrow) {
        ctx.deleteMessage()
        if (ctx.message.text.indexOf('-') == -1) {
            ctx.reply(`Неверный формат. (пример: 15:00 - 16:00)`)
            return
        }
        let userTime = ctx.message.text.split('-')
        let firstNumber = userTime[0].trim()
        let secondNumber = userTime[1].trim()

        let firstNumberSlice = firstNumber.split(':')
        let firstNumber1 = firstNumberSlice[0]
        let firstNumber2 = firstNumberSlice[1]

        let secondNumberSlice = secondNumber.split(':')
        let secondNumber1 = secondNumberSlice[0]
        let secondNumber2 = secondNumberSlice[1]

        if (23 < secondNumber1 || secondNumber1 < 0 || 59 < secondNumber2 || secondNumber2 < 0 || 23 < firstNumber1 || firstNumber1 < 0 || 59 < firstNumber2 || firstNumber2 < 0) {
            ctx.reply(`Неверный формат. (пример: 15:00 - 16:00)`)
            return
        }

        let firstDate = dayjs().date(dayjs().date() + 1).minute(firstNumber2).hour(firstNumber1).second(0).format()
        let secondDate = dayjs().date(dayjs().date() + 1).minute(secondNumber2).hour(secondNumber1).second(0).format()

        if (firstDate > secondDate) {
            ctx.reply(`Неверный формат. (пример: 15:00 - 16:00)`)
            return
        }

        let signs = await Washing.find().sort({ startTime: 1 })
        let wrong = 0;

        for (let i = 0; i < signs.length; i++) {
            if (dayjs(signs[i].startTime).format() < firstDate && dayjs(signs[i].endTime).format() > firstDate) {
                ctx.reply(`Данное время уже занято, выберите другое.`)
                wrong++
                return
            } else if (dayjs(signs[i].startTime).format() < secondDate && dayjs(signs[i].endTime).format() > secondDate) {
                ctx.reply(`Данное время уже занято, выберите другое.`)
                wrong++
                return
            } else if (dayjs(signs[i].startTime).format() > firstDate && dayjs(signs[i].endTime).format() < secondDate) {
                ctx.reply(`Данное время уже занято, выберите другое.`)
                wrong++
                return
            } else if (dayjs(signs[i].startTime).format() < firstDate && dayjs(signs[i].endTime).format() < secondDate && firstDate < dayjs(signs[i].endTime).format()) {
                ctx.reply(`Данное время уже занято, выберите другое.`)
                wrong++
                return
            } else if (dayjs(signs[i].startTime).format() < firstDate && dayjs(signs[i].endTime).format() > secondDate) {
                ctx.reply(`Данное время уже занято, выберите другое.`)
                wrong++
                return
            }
        }
        if (wrong > 0) {
            return
        }

        let name = ctx.message.from.first_name
        let username = ctx.message.from.username

        ctx.reply(`Ваше время: ${firstNumber} - ${secondNumber}`, Markup.inlineKeyboard([[Markup.button.callback('Подтвердить', 'save')], [Markup.button.callback('Назад', 'tomorrow')]]))

        items = [name, username, firstDate, secondDate, firstNumber, secondNumber]
        return items
    }
})

bot.action('save', async (ctx) => {
    ctx.deleteMessage()
    let signToday = new Washing({
        name: items[0],
        username: items[1],
        startTime: items[2],
        endTime: items[3],
    });
    ctx.reply(`Готово! Вы записаны на ${items[4]} - ${items[5]}`, Markup.inlineKeyboard([[Markup.button.callback('Назад', 'cancel')]]))
    await signToday.save()
})

bot.catch((err) => {
    console.log('Ooops', err)
})

bot.launch()

require('./server')();