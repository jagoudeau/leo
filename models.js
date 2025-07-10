import { Sequelize, DataTypes } from 'sequelize';

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'chatlogs.sqlite'
});

export const ChatLog = sequelize.define('ChatLog', {
  user: DataTypes.STRING,
  message: DataTypes.TEXT,
  reply: DataTypes.TEXT,
  timestamp: DataTypes.DATE
});

export async function initDb() {
  await sequelize.sync();
}
