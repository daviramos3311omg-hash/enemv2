# ENEM Study

Plataforma de estudos para o ENEM com questões reais, usando a API pública
[ENEM.dev](https://enem.dev). Site estático — HTML, CSS e JavaScript puro
(sem frameworks, sem build step), pensado para rodar no GitHub Pages.

## Estrutura do projeto

```
/
├── index.html              # Dashboard
├── pages/
│   ├── questoes.html       # Prática de questões (filtros, favoritar, revisão)
│   ├── simulados.html      # Simulados (config, cronômetro, resultado)
│   ├── desempenho.html     # Desempenho detalhado por área
│   ├── favoritos.html      # Questões favoritas
│   └── erros.html          # Caderno de erros
├── css/
│   ├── global.css          # Tokens (claro/escuro), navegação, cartões, botões
│   ├── dashboard.css       # Específico do Dashboard
│   ├── questoes.css        # Específico da tela de prática (e reaproveitado por simulados)
│   ├── simulados.css       # Específico da tela de simulados
│   └── listas.css          # Compartilhado por desempenho/favoritos/erros
└── js/
    ├── api.js              # Única camada de comunicação com a API ENEM.dev
    ├── storage.js          # Única camada de acesso ao localStorage
    ├── utils.js            # Funções puras/helpers de DOM reutilizados
    ├── app.js               # Navegação ativa + alternância de tema
    ├── dashboard.js         # Lógica do Dashboard
    ├── questoes.js          # Lógica da prática de questões
    ├── simulados.js         # Lógica dos simulados
    ├── desempenho.js        # Lógica da página de desempenho
    ├── favoritos.js         # Lógica da página de favoritos
    └── erros.js              # Lógica do caderno de erros
```

## Como rodar localmente

O projeto usa ES Modules (`<script type="module">`), então abrir os arquivos
direto do disco (`file://`) **não funciona** — o navegador bloqueia `import`
nesse esquema. É preciso servir os arquivos por HTTP. Na raiz do projeto:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Como subir no GitHub Pages

1. **Criar o repositório** (se ainda não existir):
   ```bash
   git init
   git add .
   git commit -m "ENEM Study — versão inicial"
   ```

2. **Criar o repositório no GitHub** (pelo site github.com, sem README/gitignore
   automáticos) e conectar o remoto:
   ```bash
   git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPO.git
   git branch -M main
   git push -u origin main
   ```

3. **Ativar o GitHub Pages:**
   - No repositório, vá em **Settings → Pages**.
   - Em "Source", selecione a branch `main` e a pasta `/ (root)`.
   - Salve. O GitHub leva alguns minutos para publicar.
   - O site fica disponível em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

4. **Atualizar o site depois de mudanças:**
   ```bash
   git add .
   git commit -m "descrição da mudança"
   git push
   ```
   O GitHub Pages republica automaticamente a cada push na branch configurada.

## Estado atual do projeto

Implementado até agora:

- Prática de questões reais com filtro por área e ano
- Favoritos
- Caderno de erros (alimentado automaticamente a cada resposta errada,
  removível manualmente)
- Histórico de tentativas, desempenho por área, meta diária **e semanal**
  (editáveis pelo usuário) e sequência de estudos (streak) — tudo salvo em
  `localStorage`, sem backend
- Dashboard com gráfico de evolução da taxa de acerto
- Simulados com cronômetro obrigatório, quantidade configurável
  (10/30/90 questões), filtro de área/ano e resultado detalhado por área
- Tema claro/escuro, com preferência salva
- Recomendações simples (ponto fraco por área + área que mais melhorou nos
  últimos 7 dias), calculadas só com dados locais, sem IA externa
- Skip link, `scope="col"` nas tabelas, tabela com scroll horizontal em
  telas pequenas, `prefers-reduced-motion` respeitado
- Renderização de Markdown simples (parágrafos, **negrito**, *itálico*,
  quebras de linha) no texto-base das questões — sem biblioteca, construído
  só com `createElement`/`createTextNode` (nunca `innerHTML`, então é
  seguro mesmo com conteúdo inesperado vindo da API)

Ainda não implementado / decisão consciente de não fazer:

- Auditoria de acessibilidade com leitor de tela real (o que foi feito até
  aqui é HTML semântico + boas práticas, mas não foi testado com
  NVDA/VoiceOver de verdade)
- Recomendação por assunto (Funções, Geometria etc.) — segue bloqueada pela
  ausência desse campo na API; as recomendações atuais trabalham só no
  nível de área/disciplina. Decidi não simular isso "chutando" o assunto
  de cada questão, porque não teria como garantir que os chutes estariam
  certos.
- Markdown completo (listas, links, tabelas) no texto-base — o parser
  cobre só parágrafos, negrito, itálico e quebra de linha, que é o que
  aparece na prática nos textos do ENEM

## Limitações conhecidas da integração com a API

- A API ENEM.dev não tem endpoint de filtro por disciplina — o filtro é
  feito no cliente (`js/questoes.js`), usando a lista resumida de questões
  de cada prova.
- Não existe campo de "assunto" (ex.: Funções, Geometria) nem de
  dificuldade na API — só a área/disciplina macro (Matemática, Linguagens,
  Ciências Humanas, Ciências da Natureza). Os filtros e estatísticas por
  assunto do projeto original não são possíveis sem uma camada própria de
  categorização, que ainda não foi criada.
