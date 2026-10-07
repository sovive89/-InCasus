PROJETO: InCasus
OBJETIVO: Implementar uma camada de integração jurídica multi-provider na PWA existente.

CONTEXTO

O InCasus é uma PWA para advogados e clientes, funcionando como uma plataforma de atendimento, acompanhamento jurídico, agenda, processos, comunicação e assessoria.

Nesta primeira fase haverá apenas 1 advogado, mas a arquitetura deve nascer preparada para múltiplos advogados e escritórios (multi-tenant).

A PWA já utiliza Supabase.

==================================================
1. PRINCÍPIO DA ARQUITETURA
==================================================

NÃO integrar DataJud, Escavador, Jusbrasil ou futuros serviços diretamente às telas/componentes.

Criar uma camada intermediária:

PWA
 ↓
Legal Data Service / LegalDataProvider
 ↓
Provider Router
 ├── DataJudProvider
 ├── EscavadorProvider
 ├── JusbrasilProvider
 └── FutureProvider

O restante da aplicação deve consumir uma interface normalizada.

Exemplo:

legalData.searchProcess()
legalData.getProcess()
legalData.getMovements()
legalData.findProcessesByLawyer()
legalData.monitorProcess()
legalData.getDocuments()

A PWA não deve precisar saber de qual fornecedor o dado veio.

==================================================
2. ESTRATÉGIA DE FONTES
==================================================

Prioridade inicial:

1. BANCO LOCAL / CACHE
2. DataJud/CNJ
3. Escavador
4. Jusbrasil
5. Crawlers autorizados, se futuramente necessários

Antes de realizar uma chamada paga:

- verificar banco/cache;
- verificar data da última sincronização;
- utilizar fonte gratuita quando suficiente;
- somente utilizar provider pago quando necessário.

Criar configuração de prioridade por tipo de operação.

Exemplo:

PROCESS_DETAILS:
cache → DataJud → Escavador → Jusbrasil

MOVEMENTS:
cache → DataJud → Escavador → Jusbrasil

DOCUMENTS:
cache → Escavador/Jusbrasil

MONITORING:
webhook do provider disponível + sincronização de segurança.

==================================================
3. NORMALIZAÇÃO

Criar modelo interno independente dos providers.

Process:

id
cnj_number
court
tribunal
degree
class
subject
jurisdiction
judge
status
distribution_date
secrecy_level
last_movement_at
last_sync_at

Parties:

id
process_id
name
document (quando legalmente disponível)
type
role

Lawyers:

id
name
oab_number
oab_state

ProcessLawyers:

process_id
lawyer_id
party_id

Movements:

id
process_id
external_id
movement_code
title
description
movement_date
provider
provider_payload_hash
created_at

Documents:

id
process_id
movement_id
name
document_type
provider
external_url
storage_path
available_until
created_at

==================================================
4. IDENTIFICAÇÃO E DEDUPLICAÇÃO
==================================================

CNJ deve ser o identificador jurídico principal.

Normalizar número CNJ antes de comparação.

Se DataJud e Escavador retornarem a mesma movimentação, NÃO criar duas notificações.

Implementar deduplicação usando:

process_id
+ movement_date
+ movement_code/title
+ hash do conteúdo normalizado

Guardar a procedência separadamente.

Criar tabela:

legal_data_sources

id
entity_type
entity_id
provider
external_id
retrieved_at
raw_hash

Uma entidade interna poderá ter dados provenientes de múltiplas fontes.

==================================================
5. PROVIDERS
==================================================

Criar interface/base provider.

LegalDataProvider:

searchProcess()
getProcess()
getMovements()
findProcessesByLawyer()
getDocuments()
subscribeProcess()
unsubscribeProcess()
handleWebhook()

Cada integração implementará apenas aquilo que suporta.

Exemplo:

class DataJudProvider implements LegalDataProvider

class EscavadorProvider implements LegalDataProvider

class JusbrasilProvider implements LegalDataProvider

Retornar erro padronizado:

PROVIDER_UNAVAILABLE
NOT_SUPPORTED
RATE_LIMITED
AUTHENTICATION_ERROR
NOT_FOUND
PAYMENT_REQUIRED

O Router pode então tentar o próximo provider.

==================================================
6. PAINEL DE CONFIGURAÇÃO DENTRO DA PWA
==================================================

Criar:

Configurações
 → Integrações
    → Dados Jurídicos

Mostrar cards:

DataJud
Escavador
Jusbrasil

Cada card deve possuir:

Status:
● Conectado
● Não configurado
● Erro
● Limite atingido

Campos/configurações:

Ativar/desativar provider
Prioridade
Ambiente
Última sincronização
Último erro
Testar conexão

IMPORTANTE:

API KEYS, CLIENT SECRET E TOKENS NÃO DEVEM SER
SALVOS NO LOCALSTORAGE, FRONTEND OU BUNDLE JAVASCRIPT.

O painel da PWA pode permitir configuração, mas deve enviar
as credenciais para endpoint/backend seguro.

Preferir:

Vercel Environment Variables / backend secrets

ou solução segura equivalente.

Nunca retornar secret completo ao frontend.

Exibir apenas:

••••••••••a82f

==================================================
7. ADVOGADO / OAB
==================================================

Criar onboarding jurídico.

Advogado informa:

Nome
Número OAB
UF

Exemplo:

123456
DF

Criar:

lawyer_profiles

id
user_id
oab_number
oab_state
verified
created_at

A arquitetura deve permitir futuramente várias OABs por advogado.

==================================================
8. DESCOBERTA DE PROCESSOS
==================================================

Criar funcionalidade:

"Importar meus processos"

Fluxo:

Advogado
 ↓
OAB + UF
 ↓
LegalDataService
 ↓
provider disponível
 ↓
lista de processos encontrados
 ↓
normalização
 ↓
deduplicação
 ↓
tela de seleção

Interface:

Encontramos 38 processos relacionados à sua OAB.

[✓] Processo...
[✓] Processo...
[ ] Processo...

[Selecionar todos]

[Importar e acompanhar]

Não iniciar monitoramento pago automaticamente sem confirmação.

==================================================
9. MONITORAMENTO
==================================================

Tabela:

process_subscriptions

id
process_id
lawyer_id
provider
external_subscription_id
active
last_checked_at
next_check_at
created_at

Quando provider possuir webhook:

Provider
 ↓
/api/legal/webhooks/{provider}
 ↓
validar assinatura
 ↓
normalizar evento
 ↓
deduplicar
 ↓
salvar
 ↓
NotificationService

Quando não possuir webhook:

scheduler/cron
 ↓
buscar processos que precisam atualizar
 ↓
Provider Router
 ↓
comparar última movimentação
 ↓
registrar somente novidades

==================================================
10. NOTIFICAÇÕES
==================================================

Criar NotificationService separado do LegalDataService.

LegalDataService
 ↓
Event
 ↓
NotificationService
 ├── In-app
 ├── Web Push PWA
 ├── E-mail (futuro)
 └── WhatsApp (futuro)

Tipos:

PROCESS_MOVEMENT
NEW_PROCESS
HEARING
PUBLICATION
DOCUMENT_AVAILABLE
DEADLINE_ALERT
PROCESS_STATUS_CHANGE

Tabela:

notifications

id
user_id
process_id
type
title
body
read
action_url
created_at

Push exemplo:

"Nova movimentação"

Processo 070XXXX-XX.2026.8.07.0001
Nova movimentação registrada.

[Ver processo]

==================================================
11. CAMADA DE IA
==================================================

NÃO enviar automaticamente interpretação jurídica ao cliente.

Criar pipeline:

Movimentação original
 ↓
normalização
 ↓
IA gera resumo
 ↓
advogado revisa/aprova
 ↓
cliente recebe

Campos:

ai_summary
ai_generated_at
lawyer_approved
approved_by
approved_at

Interface:

"Resumo sugerido pela IA"

"O tribunal registrou uma nova decisão..."

[Editar]
[Aprovar e enviar ao cliente]

Preservar acesso ao texto original.

==================================================
12. CENTRAL DO ADVOGADO
==================================================

Criar dashboard:

"Central do Dia"

Exibir:

Novas movimentações
Audiências próximas
Prazos próximos
Novos processos encontrados
Clientes aguardando resposta
Resumos de IA aguardando aprovação

A Central deve utilizar dados internos normalizados,
não chamar providers diretamente durante renderização.

==================================================
13. CACHE E CUSTOS
==================================================

Evitar chamadas repetidas.

Criar:

provider_requests

id
provider
operation
process_id
success
cached
status_code
duration_ms
estimated_cost
created_at

Isso permitirá calcular futuramente:

custo por processo
custo por advogado
custo por escritório
custo por provider

Implementar TTL por operação.

Nunca chamar API externa a cada refresh da página.

==================================================
14. SEGURANÇA / LGPD
==================================================

Implementar:

RLS no Supabase
isolamento por advogado/escritório
logs de acesso
mínimo necessário de dados
controle de documentos
auditoria

Processos sigilosos NÃO devem ser tratados como processos públicos.

Nunca tentar contornar autenticação, CAPTCHA, segredo de justiça
ou mecanismos anti-bot.

==================================================
15. CRAWLING / SCRAPING
==================================================

NÃO implementar scraping agora.

Preparar apenas interface futura:

CrawlerProvider

Ele deverá obedecer:

robots/termos aplicáveis
rate limits
LGPD
restrições do tribunal
sem bypass de CAPTCHA
sem bypass de autenticação
sem acesso a processo sigiloso

Scraping é fallback, nunca fonte primária.

==================================================
16. ESTRUTURA SUGERIDA
==================================================

/lib/legal/
    legal-data-service.ts
    provider-router.ts
    normalizers/
    deduplication/
    providers/
        datajud.ts
        escavador.ts
        jusbrasil.ts

/lib/notifications/
    notification-service.ts
    push-service.ts

/api/legal/
    process/
    lawyer/
    sync/
    webhook/

/api/legal/webhooks/
    escavador/
    jusbrasil/

/components/legal/
    ProcessCard
    ProcessTimeline
    MovementCard
    ImportProcesses
    ProviderStatus
    AISummaryApproval

==================================================
17. IMPLEMENTAÇÃO EM FASES
==================================================

FASE 1

Não alterar a UI atual desnecessariamente.

Primeiro analisar arquitetura existente.

Implementar:

- schema Supabase
- LegalDataProvider
- ProviderRouter
- DataJudProvider
- normalização
- cache
- deduplicação
- consulta por CNJ
- timeline de movimentações

FASE 2

- perfil/OAB
- descoberta/importação de processos
- monitoramento
- cron

FASE 3

- PWA Web Push
- Central do Dia
- notificações

FASE 4

- EscavadorProvider
- webhooks

FASE 5

- JusbrasilProvider

FASE 6

- resumo por IA
- aprovação pelo advogado
- comunicação com cliente

==================================================
18. REGRA PRINCIPAL

Nenhuma página da aplicação deve depender diretamente de:

DataJud
Jusbrasil
Escavador

Toda consulta deve passar por:

LegalDataService

Dessa forma será possível trocar ou combinar providers sem
reescrever a aplicação.