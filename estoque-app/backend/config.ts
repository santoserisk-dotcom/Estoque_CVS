import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

export const config = {
  sheets: {
    clientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    spreadsheetId: process.env.SPREADSHEET_ID,
  },
  session: {
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
  },
  port: 3000,
};
