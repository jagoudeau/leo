import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import AdminJSSequelize from '@adminjs/sequelize';
import { sequelize, ChatLog } from './models.js';

AdminJS.registerAdapter(AdminJSSequelize);

export default async function setupAdmin(app) {
  const admin = new AdminJS({
    databases: [sequelize],
    rootPath: '/admin'
  });

  const router = AdminJSExpress.buildAuthenticatedRouter(admin, {
    authenticate: async (email, password) =>
      email === process.env.ADMIN_USER && password === process.env.ADMIN_PASS
        ? { email }
        : null,
    cookiePassword: process.env.COOKIE_PASS || 'supersecret'
  });

  app.use(admin.options.rootPath, router);
}
