import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function testAuth() {
  console.log('=== TESTE DE AUTENTICAÇÃO ===\n');
  
  // 1. Verificar variáveis
  console.log('1. Verificando variáveis de ambiente:');
  console.log('   GOOGLE_SHEETS_CLIENT_EMAIL:', process.env.GOOGLE_SHEETS_CLIENT_EMAIL);
  console.log('   SPREADSHEET_ID:', process.env.SPREADSHEET_ID);
  console.log('   GOOGLE_SHEETS_PRIVATE_KEY (primeiros 50 chars):', 
    process.env.GOOGLE_SHEETS_PRIVATE_KEY?.substring(0, 50) + '...');
  console.log('');
  
  // 2. Verificar formato da chave
  console.log('2. Verificando formato da chave:');
  const rawKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  const hasNewLines = rawKey?.includes('\\n');
  const hasRealNewLines = rawKey?.includes('\n');
  console.log('   Contém \\n literais:', hasNewLines);
  console.log('   Contém quebras de linha reais:', hasRealNewLines);
  console.log('');
  
  // 3. Tentar autenticação
  console.log('3. Tentando autenticar...');
  
  try {
    // Converter \n literais para quebras de linha reais
    const privateKey = rawKey?.replace(/\\n/g, '\n');
    
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    // Testar se consegue obter token
    const token = await auth.getAccessToken();
    console.log('   ✅ Token obtido com sucesso!');
    console.log('   Token (primeiros 20 chars):', token?.token?.substring(0, 20) + '...');
    console.log('');
    
    // 4. Testar acesso à planilha
    console.log('4. Testando acesso à planilha...');
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'CVS!A1:A3'
    });
    
    console.log('   ✅ Conexão bem-sucedida!');
    console.log('   Dados:', response.data.values);
    
  } catch (error) {
    console.error('   ❌ Erro na autenticação:', error.message);
    console.error('   Detalhes:', error.response?.data || error);
  }
}

testAuth();