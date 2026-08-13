// js/questoes.js
//
// Orquestra a página de prática (pages/questoes.html): busca uma questão
// real via api.js — respeitando os filtros de área e ano, ou um modo de
// revisão vindo de favoritos/caderno de erros —, renderiza enunciado e
// alternativas, corrige a resposta, registra o resultado em storage.js e
// carrega a próxima questão.
//
// Este arquivo nunca chama fetch() nem localStorage diretamente: toda
// comunicação passa por api.js e storage.js.
//
// Observação sobre os filtros: a API não aceita filtro por disciplina/ano no
// endpoint de questões. Por isso buscamos a lista resumida de uma prova
// (GET /exams/{year}, que traz index + discipline de cada questão) e
// filtramos no cliente antes de buscar a questão completa. Também não existe
// filtro por "assunto" (ex.: Funções, Geometria) nem por dificuldade — a API
// não expõe esses campos.

import { listarProvas, listarProva, listarQuestao, ApiError } from './api.js';
import {
  registrarTentativa,
  registrarErro,
  alternarFavorito,
  ehFavorito,
} from './storage.js';
import { escolherAleatorio, mostrarStatusEm, renderizarCorpoQuestao, renderizarAlternativas as renderizarListaAlternativas } from './utils.js';

// --- referências de DOM ---------------------------------------------------

const elStatus = document.getElementById('status');
const elEstadoVazio = document.getElementById('estado-vazio');
const elQuestaoConteudo = document.getElementById('questao-conteudo');
const elFiltroArea = document.getElementById('filtro-area');
const elFiltroAno = document.getElementById('filtro-ano');
const elBtnNovaQuestao = document.getElementById('btn-nova-questao');
const elBtnConfirmar = document.getElementById('btn-confirmar');
const elBtnProxima = document.getElementById('btn-proxima');
const elBtnFavoritar = document.getElementById('btn-favoritar');
const elFeedback = document.getElementById('feedback');
const elBannerRevisao = document.getElementById('banner-revisao');
const elBtnSairRevisao = document.getElementById('btn-sair-revisao');

const elMetaAno = document.getElementById('meta-ano');
const elMetaDisciplina = document.getElementById('meta-disciplina');
const elMetaNumero = document.getElementById('meta-numero');
const elContexto = document.getElementById('questao-contexto');
const elImagens = document.getElementById('questao-imagens');
const elEnunciado = document.getElementById('questao-enunciado');
const elAlternativas = document.getElementById('alternativas');

// --- estado em memória -----------------------------------------------------

let examesCache = null; // Array de { title, year, disciplines, languages }
const provasDetalhesCache = new Map(); // ano -> resposta de listarProva(ano)
let questaoAtual = null;
let disciplinasDaProvaAtual = []; // [{label, value}] da prova em exibição
let respondida = false;

// Modo de revisão: veio de favoritos.html ou erros.html com ?ano=YYYY&index=N
const parametrosUrl = new URLSearchParams(window.location.search);
const revisaoAno = parametrosUrl.get('ano');
const revisaoIndex = parametrosUrl.get('index');
const revisaoLanguage = parametrosUrl.get('language');
const emModoRevisao = Boolean(revisaoAno && revisaoIndex);

// Pré-seleção de área vinda de uma recomendação do dashboard (?area=matematica)
const areaSugerida = parametrosUrl.get('area');

// --- utilidades locais -------------------------------------------------

function mostrarStatus(mensagem, tipo) {
  mostrarStatusEm(elStatus, mensagem, tipo);
}

function definirCarregando(carregando) {
  elBtnNovaQuestao.disabled = carregando;
  elFiltroArea.disabled = carregando || emModoRevisao;
  elFiltroAno.disabled = carregando || emModoRevisao;
  elBtnProxima.disabled = carregando;
  mostrarStatus(carregando ? 'Carregando questão...' : '', carregando ? 'loading' : null);
}

function labelDisciplina(valor) {
  if (!valor) return 'Não informada';
  const encontrada = disciplinasDaProvaAtual.find((d) => d.value === valor);
  return encontrada ? encontrada.label : valor;
}

// --- carregamento de dados da API ------------------------------------------

async function garantirExamesCarregados() {
  if (!examesCache) {
    examesCache = await listarProvas();
    if (!examesCache.length) {
      throw new ApiError('Nenhuma prova disponível na API no momento.', {});
    }
  }
  return examesCache;
}

async function obterDetalhesProva(ano) {
  if (!provasDetalhesCache.has(ano)) {
    const detalhes = await listarProva(ano);
    provasDetalhesCache.set(ano, detalhes);
  }
  return provasDetalhesCache.get(ano);
}

const TENTATIVAS_MAX_POR_ANO = 6;

async function carregarQuestaoEspecifica(ano, index, language) {
  definirCarregando(true);
  elBtnProxima.hidden = true;
  elFeedback.hidden = true;

  try {
    // Para saber o label da disciplina, ainda buscamos os detalhes da prova.
    const detalhesProva = await obterDetalhesProva(ano);
    disciplinasDaProvaAtual = detalhesProva.disciplines || [];

    const questaoCompleta = await listarQuestao(ano, index, { language: language || undefined });
    questaoAtual = questaoCompleta;
    renderizarQuestao(questaoCompleta);

    elEstadoVazio.hidden = true;
    elQuestaoConteudo.hidden = false;
  } catch (erro) {
    tratarErro(erro);
  } finally {
    definirCarregando(false);
  }
}

async function carregarQuestaoAleatoria() {
  const areaSelecionada = elFiltroArea.value; // '' = todas as áreas
  const anoSelecionado = elFiltroAno.value; // '' = todos os anos

  definirCarregando(true);
  elBtnProxima.hidden = true;
  elFeedback.hidden = true;

  try {
    const exames = await garantirExamesCarregados();
    const anosCandidatos = anoSelecionado
      ? [anoSelecionado]
      : exames.map((exame) => String(exame.year));

    let questaoResumo = null;
    let anoEscolhido = null;
    const anosJaTentados = new Set();
    const tentativasMax = anoSelecionado
      ? 1
      : Math.min(TENTATIVAS_MAX_POR_ANO, anosCandidatos.length);

    for (let tentativa = 0; tentativa < tentativasMax && !questaoResumo; tentativa++) {
      const anosRestantes = anosCandidatos.filter((a) => !anosJaTentados.has(a));
      if (!anosRestantes.length) break;

      anoEscolhido = escolherAleatorio(anosRestantes);
      anosJaTentados.add(anoEscolhido);

      const detalhesProva = await obterDetalhesProva(anoEscolhido);
      disciplinasDaProvaAtual = detalhesProva.disciplines || [];

      const candidatas = areaSelecionada
        ? (detalhesProva.questions || []).filter((q) => q.discipline === areaSelecionada)
        : detalhesProva.questions || [];

      if (candidatas.length) {
        questaoResumo = escolherAleatorio(candidatas);
      }
    }

    if (!questaoResumo) {
      throw new ApiError(
        'Não encontramos questões para essa combinação de filtros. Tente outra área ou ano.',
        {},
      );
    }

    const questaoCompleta = await listarQuestao(anoEscolhido, questaoResumo.index, {
      language: questaoResumo.language || undefined,
    });

    questaoAtual = questaoCompleta;
    renderizarQuestao(questaoCompleta);

    elEstadoVazio.hidden = true;
    elQuestaoConteudo.hidden = false;
  } catch (erro) {
    tratarErro(erro);
  } finally {
    definirCarregando(false);
  }
}

function proximaQuestao() {
  // Depois de revisar uma questão específica, "próxima" volta ao fluxo normal
  // (aleatório/filtros) em vez de tentar carregar o mesmo índice de novo.
  if (emModoRevisao) {
    window.location.href = 'questoes.html';
    return;
  }
  carregarQuestaoAleatoria();
}

function tratarErro(erro) {
  const mensagem =
    erro instanceof ApiError ? erro.message : 'Ocorreu um erro inesperado. Tente novamente.';
  mostrarStatus(mensagem, 'erro');
  if (!questaoAtual) {
    elEstadoVazio.hidden = false;
    elQuestaoConteudo.hidden = true;
  }
}

// --- filtros -------------------------------------------------------------

function preencherSelect(elSelect, opcoes) {
  opcoes.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    elSelect.appendChild(option);
  });
}

async function inicializarFiltros() {
  try {
    const exames = await garantirExamesCarregados();

    const anosOrdenados = [...exames].sort((a, b) => b.year - a.year);
    preencherSelect(
      elFiltroAno,
      anosOrdenados.map((exame) => ({ value: String(exame.year), label: String(exame.year) })),
    );

    const disciplinasBase = anosOrdenados[0]?.disciplines || [];
    preencherSelect(
      elFiltroArea,
      disciplinasBase.map((d) => ({ value: d.value, label: d.label })),
    );

    if (areaSugerida && disciplinasBase.some((d) => d.value === areaSugerida)) {
      elFiltroArea.value = areaSugerida;
    }

    if (!emModoRevisao) {
      elFiltroArea.disabled = false;
      elFiltroAno.disabled = false;
    }
    elBtnNovaQuestao.disabled = false;
  } catch (erro) {
    tratarErro(erro);
  }
}

// --- renderização ------------------------------------------------------

function referenciaQuestaoAtual() {
  return {
    ano: questaoAtual.year,
    index: questaoAtual.index,
    disciplina: questaoAtual.discipline,
    disciplinaLabel: labelDisciplina(questaoAtual.discipline),
    titulo: questaoAtual.title,
    language: questaoAtual.language || null,
  };
}

function atualizarBotaoFavoritar() {
  if (!questaoAtual) return;
  const favoritada = ehFavorito(questaoAtual.year, questaoAtual.index);
  elBtnFavoritar.textContent = favoritada ? '★ Favoritada' : '☆ Favoritar';
  elBtnFavoritar.setAttribute('aria-pressed', String(favoritada));
  elBtnFavoritar.classList.toggle('botao-favorito--ativo', favoritada);
}

function renderizarQuestao(q) {
  respondida = false;

  elMetaAno.textContent = q.year ?? '—';
  elMetaDisciplina.textContent = labelDisciplina(q.discipline);
  elMetaNumero.textContent = q.index != null ? `Questão ${q.index}` : '';

  renderizarCorpoQuestao(q, {
    elContexto,
    elImagens,
    elEnunciado,
  });

  renderizarListaAlternativas(elAlternativas, q.alternatives || [], {
    nomeGrupo: 'alternativa',
    aoSelecionar: () => {
      elBtnConfirmar.disabled = false;
    },
  });

  atualizarBotaoFavoritar();

  elBtnConfirmar.hidden = false;
  elBtnConfirmar.disabled = true;
  elBtnProxima.hidden = true;
  elFeedback.hidden = true;
}

// --- correção ------------------------------------------------------------

function confirmarResposta() {
  if (respondida || !questaoAtual) return;

  const inputSelecionado = elAlternativas.querySelector('input[name="alternativa"]:checked');
  if (!inputSelecionado) return;

  respondida = true;
  const letraEscolhida = inputSelecionado.value;
  const acertou = letraEscolhida === questaoAtual.correctAlternative;

  elAlternativas.querySelectorAll('input[name="alternativa"]').forEach((input) => {
    input.disabled = true;
  });
  elAlternativas.querySelectorAll('.alternativa').forEach((label) => {
    if (label.dataset.letra === questaoAtual.correctAlternative) {
      label.classList.add('alternativa--correta');
    } else if (label.dataset.letra === letraEscolhida) {
      label.classList.add('alternativa--incorreta');
    }
  });

  elFeedback.hidden = false;
  elFeedback.className = acertou ? 'feedback feedback--acerto' : 'feedback feedback--erro';
  elFeedback.textContent = acertou
    ? '✅ Resposta correta'
    : `❌ Resposta incorreta — a alternativa correta era ${questaoAtual.correctAlternative}`;

  elBtnConfirmar.hidden = true;
  elBtnProxima.hidden = false;

  const referencia = referenciaQuestaoAtual();
  registrarTentativa(referencia, { respostaEscolhida: letraEscolhida, correta: acertou });
  // O caderno de erros é alimentado automaticamente a cada resposta errada;
  // a remoção manual fica disponível na página do caderno.
  if (!acertou) {
    registrarErro(referencia);
  }
}

function alternarFavoritoAtual() {
  if (!questaoAtual) return;
  alternarFavorito(referenciaQuestaoAtual());
  atualizarBotaoFavoritar();
}

// --- ligação dos eventos ---------------------------------------------------

elBtnNovaQuestao.addEventListener('click', carregarQuestaoAleatoria);
elBtnConfirmar.addEventListener('click', confirmarResposta);
elBtnProxima.addEventListener('click', proximaQuestao);
elBtnFavoritar.addEventListener('click', alternarFavoritoAtual);
elBtnSairRevisao?.addEventListener('click', () => {
  window.location.href = 'questoes.html';
});

// --- inicialização ---------------------------------------------------------

if (emModoRevisao) {
  elBannerRevisao.hidden = false;
  elFiltroArea.disabled = true;
  elFiltroAno.disabled = true;
  // Ainda inicializamos os filtros em segundo plano (populam os selects),
  // mas eles ficam desabilitados até o usuário sair do modo de revisão.
  inicializarFiltros();
  carregarQuestaoEspecifica(revisaoAno, revisaoIndex, revisaoLanguage);
} else {
  inicializarFiltros();
}
