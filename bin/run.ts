#!/usr/bin/env -S yarn ts-node -P ./tsconfig.json
import { TelegramSalesBot } from "../workers/TelegramSalesBot"
import { FunctionalityConfig } from "../config/FunctionalityConfig"
import { AllChain } from "../functions"
import * as dotenv from "dotenv"
import TelegramBot from "node-telegram-bot-api"

dotenv.config()
const config = new FunctionalityConfig()

const collectionAddress: string = process.env.COLLECTION_ADDRESS || ""
const chatId: string = process.env.TELEGRAM_CHAT_ID || ""

const networkName = config.network as AllChain

if (!collectionAddress) throw new Error("COLLECTION_ADDRESS is not set in .env file")
if (!chatId) throw new Error("TELEGRAM_CHAT_ID is not set in .env file")

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(config.telegramBotToken, { polling: true });

// Get bot information
bot.getMe().then((botInfo) => {
  console.log('Bot Name:', botInfo.first_name);
  console.log('Bot Username:', botInfo.username);
});

// bot.on('message', (msg) => {
//   const chatId = msg.chat.id;
//   console.log('Received a message from chat ID:', chatId);
//   bot.sendMessage(chatId, 'I received your message. This chat ID is: ' + chatId);
// });

// console.log('Bot is running. Send a message to the bot to get the chat ID.');

const CHECK_INTERVAL = 5 * 1000 // 5 seconds
const salesBot = new TelegramSalesBot(CHECK_INTERVAL, networkName, collectionAddress, chatId, bot)
salesBot.run()
