// js/api.js
//
// Única camada de comunicação com a API pública ENEM.dev (https://docs.enem.dev).
// Nenhum outro arquivo do projeto deve chamar fetch() diretamente para a API.
//
// Endpoints usados (confirmados na documentação oficial em 07/08/2026):
//   GET /exams                          -> lista de provas disponíveis
//   GET /exams/{year}                   -> detalhes de uma prova (inclui lista
//                                          resumida de questões: index/discipline/language,
//                                          SEM enunciado/alternativas completos)
//   GET /exams/{year}/questions         -> questões completas de uma prova, paginadas
//                                          (limit, offset, language)
//   GET /exams/{year}/questions/{index} -> uma questão completa pelo número dela na prova
//
// A API não exige chave/autenticação (confirmado no OpenAPI: security: []).

const BASE_URL = 'https://api.enem.dev/v1';

/**
 * Erro de API com informações estruturadas para a camada de UI decidir o que exibir.
 */
export class ApiError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// Mensagens amigáveis por status HTTP, conforme documentado em /errors.
function mensagemAmigavel(status) {
  switch (status) {
    case 400:
      return 'A requisição enviada estava malformada.';
    case 404:
      return 'A prova ou questão solicitada não foi encontrada.';
    case 422:
      return 'Os parâmetros enviados não puderam ser processados.';
    case 429:
      return 'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.';
    case 500:
      return 'A API do ENEM.dev encontrou um erro interno. Tente novamente em instantes.';
    default:
      return 'Não conseguimos carregar os dados agora. Verifique sua conexão e tente novamente.';
  }
}

const TIMEOUT_PADRAO_MS = 10000;

async function request(path, { params, timeoutMs = TIMEOUT_PADRAO_MS } = {}) {
  const url = new URL(BASE_URL + path);
  if (params) {
    for (const [chave, valor] of Object.entries(params)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        url.searchParams.set(chave, valor);
      }
    }
  }

  const controlador = new AbortController();
  const timeoutId = setTimeout(() => controlador.abort(), timeoutMs);

  let resposta;
  try {
    resposta = await fetch(url.toString(), { signal: controlador.signal });
  } catch (erro) {
    if (erro.name === 'AbortError') {
      throw new ApiError('A requisição demorou demais para responder. Tente novamente.', {});
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new ApiError('Você está sem conexão com a internet.', {});
    }
    // DNS, CORS bloqueado ou outra falha de rede.
    throw new ApiError('Não foi possível conectar à API. Verifique sua internet.', {});
  } finally {
    clearTimeout(timeoutId);
  }

  if (!resposta.ok) {
    let code = null;
    try {
      const corpo = await resposta.json();
      code = corpo?.error?.code ?? null;
    } catch {
      // corpo de erro não era JSON válido — segue com mensagem genérica por status
    }
    throw new ApiError(mensagemAmigavel(resposta.status), {
      status: resposta.status,
      code,
    });
  }

  try {
    return await resposta.json();
  } catch {
    throw new ApiError('A API retornou uma resposta em formato inesperado.', {});
  }
}

/**
 * Lista todas as provas disponíveis.
 * Retorna: Array<{ title, year, disciplines: [{label, value}], languages: [{label, value}] }>
 */
export function listarProvas() {
  return request('/exams');
}

/**
 * Detalhes de uma prova: disciplinas, idiomas e a lista resumida de todas as
 * questões dela (title, index, discipline, language — sem conteúdo completo).
 * Útil para descobrir quais índices existem e a qual disciplina cada um pertence.
 */
export function listarProva(ano) {
  return request(`/exams/${encodeURIComponent(ano)}`);
}

/**
 * Lista questões completas de uma prova, paginada.
 * Retorna: { metadata: { limit, offset, total, hasMore }, questions: [...] }
 */
export function listarQuestoes(ano, { limit = 10, offset = 0, language } = {}) {
  return request(`/exams/${encodeURIComponent(ano)}/questions`, {
    params: { limit, offset, language },
  });
}

/**
 * Detalhes completos de uma única questão, pelo número dela na prova.
 */
export function listarQuestao(ano, index, { language } = {}) {
  return request(`/exams/${encodeURIComponent(ano)}/questions/${encodeURIComponent(index)}`, {
    params: { language },
  });
}
