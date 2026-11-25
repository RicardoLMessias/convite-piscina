# Convite da Olivia

Projeto **React + Vite**, mobile-first, seguindo o design de referência enviado: quatro páginas em tela cheia, cartões ilustrados, navegação por setas e pontos, elementos de piscina e fundo aquático interativo.

## Rodar localmente

```bash
npm install
npm run dev
```

Para testar o formulário contra o backend PHP, configure o banco em `api/config.php` e inicie o PHP em outro terminal:

```bash
npm run dev:php
```

O projeto React envia as confirmações para `POST /api/rsvp`. O Vite encaminha `/api` e `/admin` ao servidor PHP local. O banco de dados é criado com `schema.sql`.

## Gerar a versão de publicação

```bash
npm run build
npm run preview
```

## Onde editar

- `src/config/event.js`: textos e valores locais de apresentação.
- `api/config.php` e `schema.sql`: acesso ao MySQL, contas do painel e dados editáveis do evento.
- `src/config/navigation.js`: ordem e nomes das seções.
- `src/components/sections/`: conteúdo de cada seção do convite.
- `src/components/layout/`: fundo, cabeçalho e rodapé.
- `src/components/navigation/`: navegação entre seções.
- `src/hooks/`: lógica reutilizável, como a contagem regressiva.
- `src/styles.css`: aparência e comportamento responsivo.
- `public/assets/`: logo e ilustrações de piscina usadas nas páginas.
- `public/water-3d.js`: efeito aquático WebGL copiado do projeto original.
- `api/`: endpoints PHP para RSVP e painel.
- `admin.html`, `admin.js` e `admin-styles.css`: painel de acompanhamento em `/admin`.
- `router.php` e `.htaccess`: roteamento PHP para desenvolvimento local e hospedagem Apache.

## Dados a completar

Antes da publicação, configure o banco em `api/config.php` e altere as contas e senhas de exemplo do painel. Importe `schema.sql`; depois, atualize endereço, WhatsApp e os demais dados no painel `/admin`. A data inicial está configurada para 05/12/2026 às 13h, horário de Brasília.
