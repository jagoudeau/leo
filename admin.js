const AdminJS = require("adminjs");
const AdminJSExpress = require("@adminjs/express");
const { sequelize, ChatLog } = require("./models");

AdminJS.registerAdapter(require("@adminjs/sequelize"));

async function setupAdmin(app) {
  const admin = new AdminJS({
    databases: [sequelize],
    rootPath: "/admin"
  });

  const router = AdminJSExpress.buildAuthenticatedRouter(admin, {
    authenticate: async (email, password) =>
      email === process.env.ADMIN_USER && password === process.env.ADMIN_PASS
        ? { email }
        : null,
    cookiePassword: process.env.COOKIE_PASS || "supersecret"
  });

  app.use(admin.options.rootPath, router);
}

module.exports = setupAdmin;
