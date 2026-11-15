# InCasus

Sistema jurídico com área do advogado e do cliente. Aplicação React/TanStack Start, servidor Node.js e backend Supabase independente (PostgreSQL, Auth e Storage). O desenvolvimento e a execução não dependem de um editor ou gateway externo.

## Executar localmente

Requisitos: Node.js 24, npm e Docker com Compose v2.

```sh
npm ci
npm run backend:up
npm run dev:local
```

Aplicação: `http://localhost:8080`. Caixa de e-mails de teste: `http://localhost:54324`.

O primeiro comando do backend gera credenciais aleatórias em arquivos ignorados pelo Git. O ambiente usa volumes persistentes para o banco e os originais. `npm run backend:stop` para os serviços sem apagar os volumes; `npm run backend:up` os retoma. As portas do backend ficam vinculadas ao loopback.

Contas novas começam como cliente. O acesso profissional exige promoção administrativa, nunca um campo escolhido no cadastro. Veja [a preparação do backend e a publicação](docs/BACKEND-INDEPENDENTE.md).

## Implementado nesta etapa

- Login com senha, cadastro com confirmação por e-mail e recuperação de senha.
- Processos, permissões de leitura e agenda autenticados.
- Escritório, clientes e vários casos por cliente, incluindo inquérito sem CNJ.
- Notas internas por caso, com revisão concorrente controlada e histórico de versões.
- Documentos, provas e áudios originais em armazenamento privado, com origem, tamanho, data e SHA-256 conferido no servidor.
- Download temporário autorizado e auditoria gerada pelo banco.

As integrações de WhatsApp/voz, RAG, assinatura e gestão financeira completa continuam no escopo, ainda não concluídas. O módulo de cadastro não cria login nem compartilha arquivos automaticamente com o cliente.

## Verificar

```sh
npm run test:dossier
npm run test:backend
npm run build:local
npm run test:e2e
```

O teste de backend cria somente dados e contas fictícios no ambiente local e prepara as credenciais temporárias para os testes de navegador. Os testes de navegador esperam a aplicação em execução e Chromium instalado (`INCASUS_CHROMIUM` permite indicar outro executável). Não usam chaves de serviços de IA nem fazem chamadas pagas.

## Publicar

`npm run build` produz um servidor Node em `.output/server/index.mjs`. Também há um `Dockerfile`. Configure o seu próprio backend e as variáveis de [.env.example](.env.example); veja [o roteiro de publicação](docs/BACKEND-INDEPENDENTE.md).
