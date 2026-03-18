"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
let cachedApp;
async function createApp() {
    if (cachedApp)
        return cachedApp;
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({ origin: true });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    await app.init();
    cachedApp = app;
    return app;
}
async function handler(req, res) {
    try {
        const app = await createApp();
        const server = app.getHttpAdapter().getInstance();
        server(req, res);
    }
    catch (err) {
        console.error('[Vercel] Handler crashed:', err);
        const r = res;
        r.status(500).json({ message: 'Internal server error', detail: String(err) });
    }
}
if (!process.env.VERCEL) {
    createApp()
        .then(async (app) => {
        const port = process.env.PORT ?? 3000;
        await app.listen(port);
        console.log(`POS API running at http://localhost:${port}/api`);
    })
        .catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=main.js.map