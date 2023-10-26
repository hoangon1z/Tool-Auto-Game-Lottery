
const mysql = require('mysql2');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// Token API của bot Telegram
const telegramToken = '6625257387:AAFOm9ZdaGrfnqJsXr8xWK-lJeEci054TaQ';
const telegramUserId = '@BotMay68vn';

// Khởi tạo bot Telegram
const bot = new TelegramBot(telegramToken, { polling: true });

let botActive = false;

const adminIds = ['6127685762', '5664276592']; // Thay thế bằng ID của các admin
// Xử lý route mặc định

bot.onText(/\/startbot/, (msg) => {
    const chatId = msg.chat.id;
    if (adminIds.includes(msg.from.id.toString())) {
        botActive = true;
        bot.sendMessage(chatId, 'Bot đã được kích hoạt.');
        start_bot();
    } else {
        bot.sendMessage(chatId, 'Xin lỗi, bạn không có quyền để nhắn lệnh này, Cút ngay');
    }
});

bot.onText(/\/stopbot/, (msg) => {
    const chatId = msg.chat.id;
    if (adminIds.includes(msg.from.id.toString())) {
        botActive = false;
        bot.sendMessage(chatId, 'Bot đã được tắt.');
    } else {
        bot.sendMessage(chatId, 'Xin lỗi, bạn không có quyền để nhắn lệnh này, Cút ngay');
    }
});
// Cấu hình kết nối database
const db_config = {
    host: '139.99.22.174',
    user: 'may68',
    password: '123123',
    database: 'may68',
};

// Kết nối tới database
let pool = mysql.createPool(db_config);

const historyFile = 'history_noti.json';



const processedPeriods = new Set();

function get_new_period() {
    const queryString = "SELECT * FROM wingo WHERE game = 'wingo' AND status = 0 ORDER BY period ASC LIMIT 1";

    return new Promise((resolve, reject) => {
        pool.query(queryString, (error, results, fields) => {
            if (error) reject(error);
            else resolve(results);
        });
    });
}
let previousResult;
try {
    previousResult = JSON.parse(fs.readFileSync('result_bet.json', 'utf8'));
} catch (error) {
    previousResult = {};
}
async function start_bot() {
    if (!botActive) {
        return;
    }
    await send_message(telegramUserId, '"Bot đang chuẩn bị chạy\n Mọi người sẵn sàng nhé !!!"');
    try {
        let processedCount = 0;
        let totalWins = 0;
        let totalLosses = 0;

        while (true) {
            const result = await get_new_period();
            if (result.length > 0) {
                const period = result[0].period;
                if (!processedPeriods.has(period)) {
                    processedPeriods.add(period);
                    await send_message(telegramUserId, `Phiên ${period}. Bắt đầu !`);

                    // Đọc các kết quả cuối cùng từ file result_bet.json
                let betHistory;
                try {
                    betHistory = JSON.parse(fs.readFileSync('result_bet.json', 'utf8'));
                } catch (error) {
                    betHistory = {};
                }

                // Lấy các kết quả cuối cùng dưới dạng mảng
                const lastResults = Object.values(betHistory).slice(-5);

                // Quyết định cược tiếp theo dựa trên các kết quả cuối cùng
                let betChoice;
                if (lastResults.slice(-2).every(result => result === 'Lớn')) {
                    betChoice = 'Lớn';
                } else if (lastResults.slice(-2).every(result => result === 'Nhỏ')) {
                    betChoice = 'Nhỏ';
                } else if (lastResults.slice(-3).every(result => result === 'Lớn')) {
                    betChoice = 'Lớn';
                } else if (lastResults.slice(-3).every(result => result === 'Nhỏ')) {
                    betChoice = 'Nhỏ';
                } else {
                    betChoice = Math.random() < 0.5 ? 'Lớn' : 'Nhỏ';
                }

                await send_message(telegramUserId, `🔉 Mọi người ! Hãy cược ${betChoice}`);
                    await send_message(telegramUserId, '⏳ Chờ kết quả ...');
                    await send_message(telegramUserId, '⏳');
                    update_history(period);

                    while (true) {
                        const [row] = await query(`SELECT amount, status FROM wingo WHERE game = 'wingo' AND period = ${period}`);
                        
                        if (row && row.status === 1) {
                            const newAmount = row.amount;
                            //console.log('Kết quả truy vấn mới:', [(period, newAmount)]);
        
                            update_result_file(period, newAmount);

                            if (newAmount >= 0 && newAmount <= 4) {
                                //console.log('Kết quả: Nhỏ');
                                send_message(telegramUserId, '🎲 Kết quả lượt vừa xong : Nhỏ');
                                if (betChoice === 'Nhỏ') {
                                  await send_message(telegramUserId, '💰 Kết quả 🏆 Thắng');
                                  await send_sticker(telegramUserId, 'AnimatedSticker.tgs');
                                  totalWins++;
                                  if (totalWins >= 1000) totalWins = 0; // Reset totalWins if it reaches 1000
                              } else {
                                  await send_message(telegramUserId, '💰 Kết quả ❌ Thua');
                                  totalLosses++;
                                  if (totalLosses >= 1000) totalLosses = 0; // Reset totalLosses if it reaches 1000
                              }
                                update_bet_result(period, 'Nhỏ');
                            } else if (newAmount >= 5 && newAmount <= 9) {
                                //console.log('Kết quả: Lớn');
                                await send_message(telegramUserId, '🎲 Kết quả lượt vừa xong: Lớn');
                                if (betChoice === 'Lớn') {
                                    await send_message(telegramUserId, '💰 Kết quả 🏆 Thắng');

                                    await send_sticker(telegramUserId, 'AnimatedSticker.tgs');
                                
                                    totalWins++;
                                    if (totalWins >= 1000) totalWins = 0; 
                                } else {
                                    await send_message(telegramUserId, '💰 Kết quả ❌ Thua');
                                    totalLosses++;
                                    if (totalLosses >= 1000) totalLosses = 0;
                                }
                                update_bet_result(period, 'Lớn');
                            }

                            await send_message(telegramUserId, `Tổng Thắng 🏆: ${totalWins}\n\nTổng Thua ❌: ${totalLosses}`);
                            //console.log('Bot đã kết thúc.');
                            processedCount++;
                            break;
                        }

                        await delay(5000); // Poll every 5 seconds
                    }
                }
            }

            if (pool.state !== 'disconnected') {
                pool.end(function(err){
                  if (err) {
                    console.log ('Error')
                  } else {
                    console.log ('Connect pool end')
                  }
                });
            }
            pool = mysql.createConnection(db_config);
        }
    
        

    } catch (error) {
        // Gửi tin nhắn thông báo lỗi đến adminIds
        for (const adminId of adminIds) {
            await send_message(adminId, `Bot gặp lỗi: ${error}`);
        }
    } finally {
        if (pool.state !== 'disconnected') {
            pool.destroy();
        }
    }
}
function decideBetChoice(lastResults) {
    const count = {
        'Lớn': 0,
        'Nhỏ': 0
    };

    for (let i = lastResults.length - 1; i >= 0; i--) {
        count[lastResults[i]]++;
        if (count['Lớn'] === 1 && count['Nhỏ'] === 1) return 'Lớn';
        if (count['Nhỏ'] === 1 && count['Lớn'] === 1) return 'Nhỏ';
        if (count['Lớn'] >= 3) return 'Lớn';
        if (count['Nhỏ'] >= 3) return 'Nhỏ';
    }

}

function update_history(period) {
    try {
        let historyData;
        try {
            historyData = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
        } catch (error) {
            historyData = {};
        }
    
        historyData[period] = true;

        fs.writeFileSync(historyFile, JSON.stringify(historyData));
    } catch (error) {
        console.log('Lỗi khi cập nhật lịch sử:', error);
    }
}

function update_result_file(period, newAmount) {
    try {
        let data;
        try {
            data = JSON.parse(fs.readFileSync('result.json', 'utf8'));
        } catch (error) {
            data = {};
        }

        data[period] = newAmount;

        fs.writeFileSync('result.json', JSON.stringify(data));
    } catch (error) {
        console.log('Lỗi khi cập nhật kết quả:', error);
    }
}

async function query(queryString) {
    return new Promise((resolve, reject) => {
        pool.query(queryString, (error, results, fields) => {
            if (error) reject(error);
            else resolve(results);
        });
    });
}


function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function update_bet_result(period, result) {
    try {
        let data;
        try {
            data = JSON.parse(fs.readFileSync('result_bet.json', 'utf8'));
        } catch (error) {
            data = {};
        }

        data[period] = result;

        fs.writeFileSync('result_bet.json', JSON.stringify(data));
    } catch (error) {
        console.log('Lỗi khi cập nhật kết quả cược:', error);
    }
}
function handleDisconnect() {
  pool = mysql.createPool(db_config); // Recreate the connection pool

  pool.getConnection((err, connection) => {
      if(err) {                             
          console.log('error when connecting to db:', err);
          setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect
      } else if (connection) {
          connection.release();
      }                                     
  });                                     

  pool.on('error', function(err) {
      console.log('db error', err);
      if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
          handleDisconnect();                         // lost due to either server restart, or a
      } else {                                      // connection idle timeout
          throw err;                                  
      }
  });
}
function send_message(chat_id, message, isSticker = false) {
    return new Promise((resolve, reject) => {
        if (isSticker) {
            bot.sendSticker(chat_id, message)
                .then(() => resolve())
                .catch(error => reject(error));
        } else {
            bot.sendMessage(chat_id, message)
                .then(() => resolve())
                .catch(error => reject(error));
        }
    });
}
function send_sticker(chat_id, stickerPath) {
    return new Promise((resolve, reject) => {
        bot.sendSticker(chat_id, stickerPath)
            .then(() => resolve())
            .catch(error => reject(error));
    });
}


handleDisconnect();

start_bot();
