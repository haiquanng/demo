import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Build ra một file index.html duy nhất để mở trực tiếp hoặc chia sẻ.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
});
