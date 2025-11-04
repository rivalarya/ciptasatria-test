import { defineConfig, env } from "prisma/config";
import dotenv from 'dotenv';
import fs from 'fs';

if(fs.existsSync('.env')) {
    dotenv.config({path: '.env'});
} else {
    dotenv.config({path: '.env.example'});
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
