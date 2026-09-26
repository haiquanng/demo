import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

/** Chạy các function trong /api ngay trong Vite dev, giống cách Vercel chạy. */
function apiDev(): Plugin {
  return {
    name: "api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Chỉ bắt lệnh gọi function (POST /api/launch...). Trình duyệt vẫn tải được /api/_specs.ts như module thường.
        if (req.method !== "POST" || !/^\/api\/[a-z-]+(\?|$)/.test(req.url ?? "")) return next();
        try {
          const url = req.url ?? "";
          const name = url.split("?")[0].slice(5);
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const request = new Request("http://localhost" + url, {
            method: req.method,
            headers: { "content-type": req.headers["content-type"] ?? "application/json" },
            body: Buffer.concat(chunks),
          });
          const handler = mod.POST;
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          const reader = response.body!.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [react(), tailwind(), apiDev(), viteSingleFile()],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  };
});
