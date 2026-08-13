// js/storage.js
//
// Única camada de acesso ao localStorage do projeto. Nenhum outro arquivo
// deve chamar localStorage diretamente — tudo passa pelas funções daqui.
//
// Guarda: histórico de tentativas, favoritos, caderno de erros, metas e a
// sequência de estudos (streak). Tudo fica no navegador do usuário; não há
// sincronização com servidor (o projeto não tem backend, por decisão do
// escopo inicial).

import { dataLocalISO } from './utils.js';

const PREFIXO = 'enemStudy:';
const CHAVES = {
  historico: `${PREFIXO}historico`,
  favoritos: `${PREFIXO}favoritos`,
  erros: `${PREFIXO}erros`,
  metas: `${PREFIXO}metas`,
  streak: `${PREFIXO}streak`,
  config: `${PREFIXO}config`,
  simulados: `${PREFIXO}simulados`,
};

function ler(chave, valorPadrao) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : valorPadrao;
  } catch {
    // localStorage indisponível (modo privado restrito, JSON corrompido, etc.)
    // — falha de forma silenciosa e devolve o padrão, sem quebrar a página.
    return valorPadrao;
  }
}

function escrever(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    // Quota excedida ou localStorage indisponível: a UI que chamou continua
    // funcionando normalmente, só não persiste dessa vez.
    return false;
  }
}

// --- histórico -------------------------------------------------------------

export function obterHistorico() {
  return ler(CHAVES.historico, []);
}

/**
 * Registra uma tentativa de resposta e atualiza a sequência de estudos.
 * questaoRef: { ano, index, disciplina, disciplinaLabel, titulo }
 */
export function registrarTentativa(questaoRef, { respostaEscolhida, correta }) {
  const historico = obterHistorico();
  historico.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...questaoRef,
    respostaEscolhida,
    correta,
    data: new Date().toISOString(),
  });
  escrever(CHAVES.historico, historico);
  atualizarStreak();
}

// --- favoritos ---------------------------------------------------------

export function obterFavoritos() {
  return ler(CHAVES.favoritos, []);
}

export function ehFavorito(ano, index) {
  return obterFavoritos().some((f) => f.ano === ano && f.index === index);
}

/** Adiciona ou remove dos favoritos. Retorna true se ficou favoritada. */
export function alternarFavorito(questaoRef) {
  const favoritos = obterFavoritos();
  const posicao = favoritos.findIndex(
    (f) => f.ano === questaoRef.ano && f.index === questaoRef.index,
  );
  if (posicao >= 0) {
    favoritos.splice(posicao, 1);
    escrever(CHAVES.favoritos, favoritos);
    return false;
  }
  favoritos.push({ ...questaoRef, adicionadoEm: new Date().toISOString() });
  escrever(CHAVES.favoritos, favoritos);
  return true;
}

export function removerFavorito(ano, index) {
  const favoritos = obterFavoritos().filter((f) => !(f.ano === ano && f.index === index));
  escrever(CHAVES.favoritos, favoritos);
}

// --- caderno de erros -----------------------------------------------------

export function obterCadernoDeErros() {
  return ler(CHAVES.erros, []);
}

export function registrarErro(questaoRef) {
  const caderno = obterCadernoDeErros();
  const existente = caderno.find((e) => e.ano === questaoRef.ano && e.index === questaoRef.index);
  const agora = new Date().toISOString();
  if (existente) {
    existente.vezes += 1;
    existente.ultimoErroEm = agora;
  } else {
    caderno.push({ ...questaoRef, vezes: 1, primeiroErroEm: agora, ultimoErroEm: agora });
  }
  escrever(CHAVES.erros, caderno);
}

export function removerDoCadernoDeErros(ano, index) {
  const caderno = obterCadernoDeErros().filter((e) => !(e.ano === ano && e.index === index));
  escrever(CHAVES.erros, caderno);
}

// --- metas -------------------------------------------------------------

const METAS_PADRAO = { diaria: 30, semanal: 150 };

export function obterMetas() {
  return ler(CHAVES.metas, METAS_PADRAO);
}

export function definirMetas(metas) {
  escrever(CHAVES.metas, { ...obterMetas(), ...metas });
}

// --- sequência de estudos (streak) -----------------------------------

const STREAK_PADRAO = { atual: 0, melhor: 0, ultimoDiaEstudado: null };

export function obterStreak() {
  return ler(CHAVES.streak, STREAK_PADRAO);
}

// Um dia conta como "estudado" quando pelo menos uma questão é respondida
// nele. Chamada internamente por registrarTentativa().
function atualizarStreak() {
  const hoje = dataLocalISO();
  const streak = obterStreak();

  if (streak.ultimoDiaEstudado === hoje) return; // já contabilizado hoje

  const ontem = dataLocalISO(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const novoAtual = streak.ultimoDiaEstudado === ontem ? streak.atual + 1 : 1;

  escrever(CHAVES.streak, {
    atual: novoAtual,
    melhor: Math.max(streak.melhor, novoAtual),
    ultimoDiaEstudado: hoje,
  });
}

// --- resumo de desempenho (agregado a partir do histórico) --------------

export function obterResumoDesempenho() {
  const historico = obterHistorico();
  const total = historico.length;
  const acertos = historico.filter((h) => h.correta).length;

  const porDisciplina = {};
  historico.forEach((h) => {
    const chave = h.disciplina || 'nao-informada';
    if (!porDisciplina[chave]) {
      porDisciplina[chave] = { label: h.disciplinaLabel || chave, total: 0, acertos: 0 };
    }
    porDisciplina[chave].total += 1;
    if (h.correta) porDisciplina[chave].acertos += 1;
  });

  const hoje = dataLocalISO();
  const resolvidasHoje = historico.filter((h) => h.data.slice(0, 10) === hoje).length;

  const seteAtras = dataLocalISO(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const resolvidasNaSemana = historico.filter((h) => h.data.slice(0, 10) >= seteAtras).length;

  return {
    total,
    acertos,
    taxaAcerto: total ? (acertos / total) * 100 : 0,
    porDisciplina,
    resolvidasHoje,
    resolvidasNaSemana,
  };
}

/**
 * Taxa de acerto e volume por dia, nos últimos `dias` dias (incluindo hoje).
 * Usado no gráfico de evolução do dashboard/desempenho.
 */
export function obterEvolucaoDiaria(dias = 14) {
  const historico = obterHistorico();
  const porDia = new Map();

  historico.forEach((h) => {
    const dia = h.data.slice(0, 10);
    if (!porDia.has(dia)) porDia.set(dia, { total: 0, acertos: 0 });
    const registro = porDia.get(dia);
    registro.total += 1;
    if (h.correta) registro.acertos += 1;
  });

  const resultado = [];
  for (let i = dias - 1; i >= 0; i--) {
    const dia = dataLocalISO(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
    const registro = porDia.get(dia);
    resultado.push({
      dia,
      total: registro ? registro.total : 0,
      taxaAcerto: registro && registro.total ? (registro.acertos / registro.total) * 100 : null,
    });
  }
  return resultado;
}

// --- recomendações simples (sem IA externa, só dados locais) --------------
//
// A API não expõe "assunto" (Funções, Geometria etc.), então as
// recomendações trabalham no nível de área/disciplina, que é o que temos.

const MINIMO_QUESTOES_PARA_RECOMENDAR = 5;

function taxaAcertoNoPeriodo(historico, disciplina, inicioISO, fimISO) {
  const doPeriodo = historico.filter(
    (h) => h.disciplina === disciplina && h.data.slice(0, 10) >= inicioISO && h.data.slice(0, 10) < fimISO,
  );
  if (!doPeriodo.length) return null;
  const acertos = doPeriodo.filter((h) => h.correta).length;
  return { taxa: (acertos / doPeriodo.length) * 100, total: doPeriodo.length };
}

export function obterRecomendacoes() {
  const historico = obterHistorico();
  const recomendacoes = [];

  const porDisciplina = {};
  historico.forEach((h) => {
    const chave = h.disciplina || 'nao-informada';
    if (!porDisciplina[chave]) {
      porDisciplina[chave] = { label: h.disciplinaLabel || chave, total: 0, acertos: 0 };
    }
    porDisciplina[chave].total += 1;
    if (h.correta) porDisciplina[chave].acertos += 1;
  });

  // 1) Área com pior desempenho (só sugere com uma amostra mínima).
  const disciplinasComAmostra = Object.entries(porDisciplina).filter(
    ([, d]) => d.total >= MINIMO_QUESTOES_PARA_RECOMENDAR,
  );
  if (disciplinasComAmostra.length) {
    const [chavePior, pior] = disciplinasComAmostra.reduce((piorAtual, atual) => {
      const taxaAtual = atual[1].acertos / atual[1].total;
      const taxaPior = piorAtual[1].acertos / piorAtual[1].total;
      return taxaAtual < taxaPior ? atual : piorAtual;
    });
    const taxaPior = (pior.acertos / pior.total) * 100;
    if (taxaPior < 70) {
      recomendacoes.push({
        tipo: 'ponto-fraco',
        disciplina: pior.label,
        valor: chavePior,
        texto: `Você está com ${Math.round(taxaPior)}% de acerto em ${pior.label}. Vale a pena resolver mais questões dessa área.`,
      });
    }
  }

  // 2) Área que mais melhorou nos últimos 7 dias, comparada aos 7 dias anteriores.
  const hoje = dataLocalISO();
  const seteAtras = dataLocalISO(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const catorzeAtras = dataLocalISO(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));

  let melhorMelhora = null;
  Object.entries(porDisciplina).forEach(([chave, d]) => {
    const periodoRecente = taxaAcertoNoPeriodo(historico, chave, seteAtras, hoje);
    const periodoAnterior = taxaAcertoNoPeriodo(historico, chave, catorzeAtras, seteAtras);
    if (!periodoRecente || !periodoAnterior) return;
    if (periodoRecente.total < 3 || periodoAnterior.total < 3) return;

    const melhora = periodoRecente.taxa - periodoAnterior.taxa;
    if (melhora > 5 && (!melhorMelhora || melhora > melhorMelhora.melhora)) {
      melhorMelhora = { disciplina: d.label, melhora };
    }
  });
  if (melhorMelhora) {
    recomendacoes.push({
      tipo: 'melhora',
      disciplina: melhorMelhora.disciplina,
      texto: `Seu desempenho em ${melhorMelhora.disciplina} melhorou ${Math.round(melhorMelhora.melhora)}% nos últimos 7 dias.`,
    });
  }

  return recomendacoes;
}

// --- configurações (tema) -------------------------------------------------

const CONFIG_PADRAO = { tema: 'claro' };

export function obterConfig() {
  return ler(CHAVES.config, CONFIG_PADRAO);
}

export function definirConfig(config) {
  escrever(CHAVES.config, { ...obterConfig(), ...config });
}

// --- resultados de simulados -----------------------------------------------

export function obterSimulados() {
  return ler(CHAVES.simulados, []);
}

export function registrarSimulado(resultado) {
  const simulados = obterSimulados();
  simulados.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    data: new Date().toISOString(),
    ...resultado,
  });
  escrever(CHAVES.simulados, simulados);
}
