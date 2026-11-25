# Sistema de confirmação PHP + MySQL

Este backend atende o formulário React em `POST /api/rsvp` e fornece configuração do evento em `GET /api/event`. O painel de acompanhamento fica em `/admin`.

## Como publicar

1. Crie um banco MySQL na hospedagem.
2. Importe o arquivo `schema.sql` no phpMyAdmin.
3. Edite `api/config.php` com o usuário, senha e nome do banco.
4. Gere os arquivos de publicação do React com `npm run build`.
5. Copie o conteúdo de `dist/` para a raiz pública junto dos arquivos `api/`, `admin.html`, `admin.js`, `admin-styles.css` e `.htaccess`. Mantenha `schema.sql` fora da pasta pública e importe-o pelo phpMyAdmin.
6. Acesse:

```text
/             convite público
/admin        painel de confirmações
/api/rsvp     API usada pelo formulário React
```

## Login inicial

```text
admin / drk123
cliente / cliente123
```

Troque os usuários e senhas de exemplo em `api/config.php` antes de publicar.

O banco vem com o evento Olivia Maria em 05/12/2026 às 13h. Atualize endereço, telefone, limite de acompanhantes e demais dados no painel `/admin` após importar o banco. O formulário React consulta o limite de acompanhantes e a permissão de crianças do evento no banco.

## Desenvolvimento local

Em um terminal, na raiz do projeto, inicie o servidor PHP com roteamento:

```sh
php -S 127.0.0.1:8000 router.php
```

Em outro terminal, rode `npm run dev`. O Vite encaminha `/api` e `/admin` para o backend PHP local. O MySQL também precisa estar ativo e configurado em `api/config.php`.

## Endpoints

```text
POST   /api/login
POST   /api/logout
GET    /api/session
GET    /api/event
PUT    /api/event
POST   /api/rsvp
POST   /api/broadcast/email (somente organizador)
GET    /api/dashboard
GET    /api/users
PUT    /api/guests/{id}
DELETE /api/guests/{id}
POST   /api/duplicates/resolve
GET    /api/export.pdf
```

## E-mail de confirmação

O envio usa SMTP. Configure estas variáveis no servidor PHP e mantenha a senha somente no servidor:

```text
SMTP_HOST=smtp.seuprovedor.com
SMTP_PORT=587
SMTP_ENCRYPTION=tls
SMTP_PASSWORD=sua-senha-ou-senha-de-aplicativo
MAIL_FROM_NAME=Convite Olivia Maria
```

Para Gmail, o remetente e o usuário já estão definidos como `djcontaenter@gmail.com`; o host, a porta e a criptografia usam `smtp.gmail.com`, `587` e `tls` como padrão. Configure `SMTP_PASSWORD` com uma senha de app. A senha normal pode ser recusada pelo Google; senhas de app exigem verificação em duas etapas. Consulte [a ajuda oficial do Google sobre senhas de app](https://support.google.com/accounts/answer/185833?hl=pt-BR).

Para SSL implícito use `SMTP_ENCRYPTION=ssl` e normalmente a porta `465`. O PHP precisa ter suporte a OpenSSL. Em desenvolvimento local, o e-mail só será entregue quando houver um servidor SMTP configurado e acessível. Sem isso, a confirmação continua salva no banco e o formulário informa que o e-mail não foi enviado.

Ao atualizar um banco já existente, aplique uma vez `migrations/2026-09-27-add-responsible-email.sql`. O `schema.sql` já inclui esse campo para instalações novas.

Depois de salvar, o formulário tenta enviar um resumo para o e-mail informado. Também oferece um botão que abre o WhatsApp com a resposta pronta; a pessoa escolhe a conversa consigo mesma e toca em enviar.

No dashboard do organizador, a seção “Mensagem para os convidados” envia um e-mail individual para cada endereço cadastrado, com data, programação, aviso sobre roupa de banho, endereço e mapa. Ela também prepara links de WhatsApp para os números válidos dos convidados confirmados. Cada conversa precisa ser aberta e enviada manualmente.

Os e-mails incluem data, programação e o lembrete para ir com roupa de banho. O endereço e o mapa aparecem apenas após uma confirmação positiva; a página pública informa que o endereço será liberado após confirmar presença. Salve a arte em `public/assets/convite-email.png`; o backend a incorpora no corpo HTML dos e-mails usando um identificador CID, mantendo também uma alternativa em texto simples. No WhatsApp, a confirmação positiva abre a conversa com essas informações e o endereço; a imagem pode ser compartilhada manualmente ou incluída como link público nas mensagens do dashboard quando o site estiver hospedado.
