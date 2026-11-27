# Backend independente e prontuário com arquivos

## O que mudou

A aplicação usa Vite/TanStack Start e Nitro diretamente, com destino Node. O login Google, quando habilitado, usa OAuth do Supabase configurado pelo responsável. A análise de documentos usa um adaptador servidor da API Responses da OpenAI, com saída estruturada e `store: false`; não há chamada ao antigo gateway. O provedor permanece desabilitado na prática enquanto não houver chave no servidor.

O banco local combina PostgreSQL, GoTrue, PostgREST e Storage, em serviços próprios. O manifesto `infra/backend/migrations.json` define a ordem de instalação em um banco novo. O schema inicial antigo do repositório continua como histórico e não deve ser reaplicado neste ambiente.

## Desenvolvimento

1. Instale as dependências com `npm ci`.
2. Execute `npm run backend:up`. Credenciais locais aleatórias são geradas uma única vez em `infra/backend/.env.local`; a configuração da aplicação fica em `.env.standalone.local`.
3. Execute `npm run dev:local`.
4. Cadastre uma conta e confirme no e-mail recebido no Mailpit local (`http://localhost:54324`). O Mailpit não encaminha mensagens reais.
5. Para atribuir acesso profissional a uma conta verificada neste ambiente local, um operador com acesso ao banco pode inserir o papel em `public.user_roles`. O navegador não tem essa permissão; o `user_id` é o UUID da conta, não o do cadastro de contato.

A ativação do escritório é explícita na tela de clientes. Repeti-la com a mesma conta proprietária retorna o escritório existente. Os dados de contato e os casos são persistidos no banco, com RLS. As notas são internas à equipe e nunca são exibidas ao cliente. Cadastrar um contato não concede acesso a uma conta.

`npm run backend:status` mostra os serviços. `npm run backend:migrate` verifica hashes e aplica somente migrations pendentes do manifesto. `npm run backend:stop` preserva os volumes. O bootstrap de papéis e as funções `auth.*` em `infra/backend/` são exclusivos do PostgreSQL local vazio; não os aplique a um Supabase gerenciado já existente.

## Documentos, provas e notas

Cada caso permite anexar PDF, JPG/PNG/WEBP, TXT, DOCX e áudio MP3/WAV/M4A, até 10 MB. O servidor confere bytes, formato básico e SHA-256 antes da conclusão. O original mantém nome, origem informada, tipo, tamanho e data. Não há conversão nem extração automática nessa etapa.

O recebimento ocorre em três etapas: reserva autenticada com prazo, envio privado e conferência no servidor. Uma falha não aparece como documento recebido. A conclusão exige uma função exclusiva do servidor, após verificar a identidade do solicitante, a associação ao escritório e o conteúdo realmente armazenado. A chave de serviço só existe no servidor.

As políticas do bucket não permitem sobrescrever ou excluir originais pelo navegador. O download exige autorização e um link de 60 segundos. A interface prepara o link antes do clique de download para funcionar em dispositivos móveis.

As revisões de notas acrescentam versões; não alteram versões anteriores. Uma edição baseada em versão desatualizada recebe conflito HTTP 409 e preserva o texto digitado. O histórico e a auditoria são protegidos contra alterações, inclusive por operações privilegiadas comuns.

As listas mostram até 100 registros/versões mais recentes. Não há envio para assinatura, OCR, transcrição, compartilhamento aprovado, convite de cliente ou busca RAG nesta entrega. Reservas expiradas não podem ser concluídas; limpeza periódica de arquivos de envios incompletos precisa ser configurada antes da operação em produção.

## Testes

- `npm run test:dossier`: validações, arquivos, hash, entradas e adaptador de IA sem serviço externo.
- `npm run test:backend`: teste HTTP real contra o backend local; cria contas e dados fictícios e credenciais temporárias em `/tmp/incasus-e2e-fixtures.json`, fora do repositório.
- `npm run test:e2e`: login, nota, revisão, histórico, recarga, envio, download e acesso profissional negado ao cliente, em desktop e celular. Requer o backend e a aplicação em execução.

Para testar o servidor compilado:

```sh
npm run build:local
PORT=8081 HOST=127.0.0.1 node --env-file=.env.standalone.local .output/server/index.mjs
INCASUS_APP_URL=http://localhost:8081 npm run test:e2e
```

Os testes não enviam conteúdo para IA. O modelo configurável padrão é `gpt-4.1-mini`, mas a disponibilidade real do provedor exige credenciais e validação separadas.

## Publicação em infraestrutura própria

1. Disponibilize um Supabase próprio (gerenciado ou autohospedado), com Auth e Storage, em sua conta. Em banco novo, aplique o core e as migrations do manifesto na ordem indicada. Não execute os arquivos de bootstrap de papéis do PostgreSQL local em um banco Supabase gerenciado.
2. Configure URL da aplicação e redirecionamentos de confirmação e recuperação no Auth. Use um remetente SMTP real para produção. OAuth Google só deve ser habilitado no frontend após configurar o provedor no backend.
3. Forneça `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` na compilação. Essas duas configurações são públicas. `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são configurações do servidor; nunca prefixe a chave de serviço com `VITE_`.
4. Compile com `npm run build` e execute com `npm start`, fornecendo as variáveis de servidor pelo ambiente da hospedagem. O Dockerfile recebe somente configurações públicas como argumentos de build e executa o servidor como usuário sem privilégios.
5. Configure domínio HTTPS, persistência, backups do banco e dos arquivos e limpeza de reservas expiradas. Refaça o teste integrado no destino antes de usar dados reais.

A infraestrutura local não publica o sistema na internet. Nenhum banco anterior foi alterado e não há migração automática dos registros históricos. A escolha e as credenciais do destino de produção ainda precisam ser fornecidas.
