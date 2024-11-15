const express = require("express");
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const winston = require("winston");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.LINE_ACCESS_TOKEN;

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

// ตั้งค่า Rate Limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 นาที
  max: 10, // จำกัดคำขอสูงสุด 10 ครั้งใน 1 นาที
  message: "Too many requests, please try again later.",
});

app.use("/webhook", limiter);

// ตั้งค่า Logger ด้วย Winston
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
  ],
});

// ฟังก์ชันสำหรับสร้างข้อความตอบกลับตามข้อความของผู้ใช้
function createReplyMessage(event) {
  const userMessage = event.message.text.toLowerCase();

  if (userMessage.includes("hello")) {
    return [{ type: "text", text: "Hello! How can I help you today?" }];
  }
  return [{ type: "text", text: "I'm here to help you!" }];
}

// ฟังก์ชันสำหรับส่งข้อความกลับไปยัง LINE API
async function sendLineMessage(replyToken, messages) {
  try {
    const response = await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      { replyToken, messages },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN}`,
        },
      }
    );
    logger.info("Response from LINE API:", response.data);
  } catch (error) {
    logger.error(
      "Error sending request to LINE API:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Failed to send message to LINE API");
  }
}

// Endpoint สำหรับตรวจสอบว่าเซิร์ฟเวอร์ทำงานได้
app.get("/", (req, res) => {
  res.sendStatus(200);
});

// Webhook Endpoint
app.post("/webhook", async (req, res) => {
  if (
    !req.body.events ||
    req.body.events.length === 0 ||
    !req.body.events[0].replyToken
  ) {
    logger.error("Invalid request data");
    return res.sendStatus(400); // ส่ง 400 (Bad Request) กลับไป
  }

  const replyToken = req.body.events[0].replyToken;
  const messages = createReplyMessage(req.body.events[0]);

  try {
    await sendLineMessage(replyToken, messages);
    res.sendStatus(200);
  } catch (error) {
    logger.error("Failed to send message:", error.message);
    res.sendStatus(500); // ส่ง 500 (Internal Server Error) กลับไป
  }
});

// เริ่มเซิร์ฟเวอร์
app.listen(PORT, () => {
  logger.info(`Example app listening at http://localhost:${PORT}`);
});
