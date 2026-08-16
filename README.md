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
