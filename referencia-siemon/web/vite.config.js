import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // se sirve en la raíz de crm.siemondigital.com (subdominio en el VPS)
  plugins: [react()],
});
