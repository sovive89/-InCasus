# Prontuário: implementação persistente

Atualização: notas com versões e originais privados já estão implementados e foram validados no backend local independente. Consulte [a preparação e publicação](BACKEND-INDEPENDENTE.md) e [os resultados de verificação](VERIFICACAO-PRONTUARIO.md).

## Implementado

- Ativação explícita de escritório para uma conta já reconhecida como advogado por `has_legal_role`.
- Cadastro de clientes com nome, e-mail e telefone opcionais.
- Cadastro de vários casos por cliente com matéria e etapa, incluindo inquérito policial sem número CNJ.
- Telas `/advogado/clientes`, `/advogado/clientes/$id` e `/advogado/casos` usam o serviço autenticado, substituindo os mocks dessas três rotas.
- Busca por nome, e-mail ou telefone; estados de carregamento, erro, configuração pendente e cadastro vazio.
- RLS por associação ao escritório, FK composta que impede vincular caso a cliente de outro escritório, auditoria gerada pelo banco na mesma transação e sem escrita direta pelo usuário.
- O cadastro de contato não cria login, convite ou compartilhamento automático de dados.

## Banco e publicação

A alteração ainda não foi aplicada ao banco hospedado. O projeto conectado ao frontend deve ser confirmado antes da publicação; o schema antigo do repositório difere do schema atual em `src/integrations/supabase/types.ts`.

Aplicar em homologação, nesta ordem, as duas migrations aditivas:

1. `20261113022610_office_procurement.sql`: fundação do prontuário.
2. `20261115053909_dossier_client_case_records.sql`: escrita de clientes/casos, ativação e auditoria.

Não reaplicar as migrations antigas como se fosse um banco vazio. A nova ativação usa o contrato existente `public.has_legal_role(who, wanted)`. Regenerar os tipos do banco após a aplicação. As tabelas novas recebem GRANTs explícitos além das políticas RLS; não dependem da exposição automática do Data API.

Sem a estrutura instalada, as novas telas informam configuração pendente e não exibem dados fictícios nem sucesso de gravação.

## Verificação realizada

TypeScript, build de produção, validação de entradas e testes SQL em PostgreSQL descartável. O teste SQL usa Auth mínimo e não substitui o teste HTTP no Supabase de homologação.

## Próximas entregas

Minutas geradas, vinculação a processos existentes, convites e consentimento, compartilhamento aprovado com o cliente, resumos evolutivos e RAG autorizado; integrações de mensagens, assinatura e notificações. As notas internas com versões e o recebimento de originais por caso já têm fluxo funcional no ambiente local.

Os processos e a agenda existentes continuam em seus próprios registros; não há migração automática dos mocks nem alegação de integração já concluída.
