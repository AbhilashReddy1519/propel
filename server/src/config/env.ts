import dotenv from "dotenv";
import path from "node:path";
dotenv.config({path: path.join(__dirname, './env')});

interface Config {
  env: string;
  port: number;

  database: {
    // host: string;
    // port: number;
    // username: string;
    // password: string;
    // database: string;
    url: string;
  };
  cors: {
    origin: string[];
  };
  LogLevel: string;
}

const config: Config = {
  env: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['PORT'] || '3000', 10),

  database: {
    url: process.env['DATABASE_URL'] || '',
  },
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  },
  LogLevel: process.env.LogLevel || 'info',
};

export default config;