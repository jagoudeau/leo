const { Sequelize, DataTypes } = require("sequelize");
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "chatlogs.sqlite"
});

const ChatLog = sequelize.define("ChatLog", {
  user: DataTypes.STRING,
  message: DataTypes.TEXT,
  reply: DataTypes.TEXT,
  timestamp: DataTypes.DATE
});

async function initDb() {
  await sequelize.sync();
}

module.exports = { ChatLog, initDb, sequelize };
