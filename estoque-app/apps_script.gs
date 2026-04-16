const SPREADSHEET_ID = '1FulzV2vHEAVCrmSg2jr5ozzXkqlI2cBhD0vqk4McjHY'

// Página principal (doGet é chamado quando acessar a URL)
function doGet(e) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  const action = e.parameter.action;
  
  try {
    let response;
    switch(action) {
      case 'getEstoque':
        response = getEstoque();
        break;
      case 'getTecnicos':
        response = getTecnicos();
        break;
      default:
        response = { success: false, error: 'Ação não reconhecida' };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(corsHeaders);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(corsHeaders);
  }
}

function doPost(e) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  try {
    const data = JSON.parse(e.postData.contents);
    const response = registrarRetirada(data);
    
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(corsHeaders);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(corsHeaders);
  }
}

// Função para incluir arquivos HTML (CSS/JS separados)
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ========== FUNÇÕES DO BACKEND ==========

// Buscar todos os dados do estoque
function getEstoque() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("CVS");
    const dados = sheet.getDataRange().getValues();
    const headers = dados[0];
    const items = dados.slice(1);
    
    return {
      success: true,
      data: { headers: headers, items: items }
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Registrar retirada
function registrarRetirada(data) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("CVS");
    const logSheet = getOrCreateLogSheet();
    
    const { itemNome, quantidade, tecnico, observacao, patrimonios } = data;
    
    // Buscar o item na planilha
    const dados = sheet.getDataRange().getValues();
    let linhaItem = -1;
    let estoqueAtual = 0;
    let itemData = null;
    let unidade = '';
    
    for (let i = 1; i < dados.length; i++) {
      if (dados[i][1] === itemNome) {
        linhaItem = i + 1;
        estoqueAtual = Number(dados[i][3]) || 0;
        unidade = dados[i][2] || 'un';
        itemData = dados[i];
        break;
      }
    }
    
    if (linhaItem === -1) {
      return { success: false, error: "Item não encontrado: " + itemNome };
    }
    
    if (quantidade > estoqueAtual) {
      return { success: false, error: `Estoque insuficiente. Disponível: ${estoqueAtual} ${unidade}` };
    }
    
    const novoEstoque = estoqueAtual - quantidade;
    
    // Atualizar estoque na planilha
    sheet.getRange(linhaItem, 4).setValue(novoEstoque);
    
    // Registrar no log
    logSheet.appendRow([
      new Date().toISOString(),
      itemData[0], // Categoria
      itemNome,
      quantidade,
      unidade,
      (patrimonios || []).join(", "),
      tecnico,
      observacao || "",
      estoqueAtual,
      novoEstoque
    ]);
    
    return {
      success: true,
      data: {
        item: itemNome,
        quantidadeRetirada: quantidade,
        estoqueAnterior: estoqueAtual,
        estoqueAtual: novoEstoque
      }
    };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Buscar lista de técnicos autorizados
function getTecnicos() {
  try {
    // Tenta buscar da planilha, se não existir, usa lista padrão
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("TECNICOS");
    
    if (!sheet) {
      // Lista padrão enquanto não cria a aba
      return {
        success: true,
        data: [
          { pin: "1234", nome: "Erick Santos" },
          { pin: "5678", nome: "André Souza" },
          { pin: "9012", nome: "Fernando Lima" },
          { pin: "3456", nome: "Rodrigo Mendez" }
        ]
      };
    }
    
    const dados = sheet.getDataRange().getValues();
    const tecnicos = dados.slice(1)
      .filter(row => row[2] !== "NÃO")
      .map(row => ({
        pin: String(row[0]).trim(),
        nome: row[1],
        ativo: row[2] === "SIM"
      }));
    
    return { success: true, data: tecnicos };
    
  } catch (error) {
    // Fallback para lista padrão em caso de erro
    return {
      success: true,
      data: [
        { pin: "1234", nome: "Carlos Silva" },
        { pin: "5678", nome: "André Souza" }
      ]
    };
  }
}

// Criar aba de log se não existir
function getOrCreateLogSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("LOG_RETIRADAS");
  
  if (!sheet) {
    sheet = ss.insertSheet("LOG_RETIRADAS");
    sheet.appendRow([
      "Timestamp", "Categoria", "Item", "Quantidade", "Unidade",
      "Patrimônios", "Técnico", "Observação", "Estoque Anterior", "Estoque Novo"
    ]);
  }
  
  return sheet;
}

// Teste rápido para verificar se o script está online
function testConnection() {
  return {
    success: true,
    message: "API do Estoque Pro está online!",
    timestamp: new Date().toISOString()
  };
}