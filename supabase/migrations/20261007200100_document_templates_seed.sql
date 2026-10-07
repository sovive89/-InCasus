-- Modelos-base do sistema. São ESTRUTURAS genéricas: revisão profissional obrigatória antes do uso.
insert into public.document_templates (name, category, description, body, is_system) values
('Procuração ad judicia et extra', 'procuracao', 'Procuração particular com poderes gerais para o foro (CPC, art. 105).',
$tpl$PROCURAÇÃO

OUTORGANTE: {{cliente.nome}}, {{cliente.nacionalidade}}, {{cliente.estado_civil}}, {{cliente.profissao}}, inscrito(a) no CPF sob o nº {{cliente.cpf}}, portador(a) do RG nº {{cliente.rg}}, residente e domiciliado(a) em {{cliente.endereco}}.

OUTORGADO(A): {{advogado.nome}}, advogado(a), inscrito(a) na OAB/{{advogado.oab_uf}} sob o nº {{advogado.oab}}, com escritório profissional em {{escritorio.endereco}}.

PODERES: Pelo presente instrumento, o(a) outorgante nomeia e constitui o(a) outorgado(a) seu(sua) procurador(a), conferindo-lhe os poderes da cláusula ad judicia et extra, para o foro em geral, em qualquer juízo, instância ou tribunal, podendo propor ações e defender o(a) outorgante nas contrárias, acompanhando-as até o final, com os poderes gerais previstos no art. 105 do Código de Processo Civil.

PODERES ESPECIAIS (marcar somente os que forem necessários, pois devem constar expressamente): receber citação, confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre o qual se funda a ação, receber, dar quitação, firmar compromisso e assinar declaração de hipossuficiência econômica.

FINALIDADE ESPECÍFICA: {{objeto}}

{{local}}, {{data.extenso}}.

______________________________________
{{cliente.nome}}
$tpl$, true),
('Declaração de hipossuficiência econômica', 'declaracao', 'Declaração para pedido de gratuidade da justiça (CPC, art. 98).',
$tpl$DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA

Eu, {{cliente.nome}}, {{cliente.nacionalidade}}, {{cliente.estado_civil}}, {{cliente.profissao}}, inscrito(a) no CPF sob o nº {{cliente.cpf}}, portador(a) do RG nº {{cliente.rg}}, residente e domiciliado(a) em {{cliente.endereco}}, DECLARO, sob as penas da lei, que não possuo condições de arcar com as custas, as despesas processuais e os honorários advocatícios sem prejuízo do meu sustento e do de minha família, razão pela qual requeiro os benefícios da gratuidade da justiça, nos termos do art. 98 do Código de Processo Civil.

Estou ciente de que a declaração falsa poderá acarretar as sanções previstas em lei.

{{local}}, {{data.extenso}}.

______________________________________
{{cliente.nome}}
$tpl$, true),
('Contrato de honorários advocatícios', 'contrato', 'Contrato de prestação de serviços advocatícios com honorários fixos e/ou de êxito.',
$tpl$CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS E HONORÁRIOS

CONTRATANTE: {{cliente.nome}}, {{cliente.nacionalidade}}, {{cliente.estado_civil}}, {{cliente.profissao}}, CPF nº {{cliente.cpf}}, RG nº {{cliente.rg}}, residente em {{cliente.endereco}}.

CONTRATADO(A): {{advogado.nome}}, advogado(a), OAB/{{advogado.oab_uf}} nº {{advogado.oab}}, com escritório em {{escritorio.endereco}}.

CLÁUSULA 1ª – DO OBJETO. O(A) contratado(a) prestará serviços advocatícios ao(à) contratante consistentes em: {{objeto}}.

CLÁUSULA 2ª – DOS HONORÁRIOS. Pelos serviços, o(a) contratante pagará honorários no valor de {{honorarios.valor}}, na seguinte forma: {{honorarios.forma}}.

CLÁUSULA 3ª – DOS HONORÁRIOS DE ÊXITO. {{honorarios.exito}}

CLÁUSULA 4ª – DAS DESPESAS. Custas, emolumentos, diligências, deslocamentos e demais despesas necessárias correrão por conta do(a) contratante, mediante prévia ciência.

CLÁUSULA 5ª – DAS OBRIGAÇÕES. O(A) contratado(a) empregará zelo e diligência profissional, sem garantia de resultado, por se tratar de obrigação de meio. O(A) contratante fornecerá informações e documentos verdadeiros e necessários.

CLÁUSULA 6ª – DA RESCISÃO. O contrato poderá ser rescindido por qualquer das partes, mediante comunicação escrita, devendo ser pagos os honorários proporcionais aos serviços já prestados.

CLÁUSULA 7ª – DO FORO. Fica eleito o foro de {{local}} para dirimir eventuais controvérsias.

{{local}}, {{data.extenso}}.

______________________________________        ______________________________________
{{cliente.nome}}                              {{advogado.nome}}
$tpl$, true),
('Notificação extrajudicial', 'notificacao', 'Notificação formal com prazo para cumprimento de obrigação.',
$tpl$NOTIFICAÇÃO EXTRAJUDICIAL

NOTIFICANTE: {{cliente.nome}}, CPF nº {{cliente.cpf}}, residente em {{cliente.endereco}}, representado(a) por {{advogado.nome}}, OAB/{{advogado.oab_uf}} nº {{advogado.oab}}.

NOTIFICADO(A): {{notificado.nome}}, {{notificado.endereco}}.

Por meio da presente, NOTIFICA-SE Vossa Senhoria acerca dos seguintes fatos:

{{fatos}}

Diante do exposto, fica o(a) notificado(a) intimado(a) a {{providencia}} no prazo de {{prazo}}, contado do recebimento desta, ficando ciente de que, em caso de não atendimento, serão adotadas as medidas judiciais cabíveis, com a cobrança das despesas e honorários decorrentes.

{{local}}, {{data.extenso}}.

______________________________________
{{advogado.nome}} – OAB/{{advogado.oab_uf}} nº {{advogado.oab}}
$tpl$, true),
('Petição inicial (estrutura)', 'peticao', 'Estrutura da petição inicial conforme os requisitos do CPC, art. 319.',
$tpl$EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA {{juizo}}

{{cliente.nome}}, {{cliente.nacionalidade}}, {{cliente.estado_civil}}, {{cliente.profissao}}, CPF nº {{cliente.cpf}}, RG nº {{cliente.rg}}, residente em {{cliente.endereco}}, endereço eletrônico {{cliente.email}}, por seu(sua) advogado(a) que esta subscreve (procuração anexa), com escritório em {{escritorio.endereco}}, vem, respeitosamente, propor a presente

AÇÃO {{acao}}

em face de {{reu.nome}}, {{reu.qualificacao}}, pelos fatos e fundamentos a seguir expostos.

I – DOS FATOS
{{fatos}}

II – DO DIREITO
{{fundamentos}}

III – DA TUTELA DE URGÊNCIA (se cabível)
{{tutela}}

IV – DOS PEDIDOS
Ante o exposto, requer:
a) a citação do(a) réu(ré) para, querendo, apresentar resposta;
b) {{pedidos}}
c) a condenação do(a) réu(ré) ao pagamento de custas e honorários advocatícios;
d) a produção de todas as provas em direito admitidas.

V – DAS PROVAS
Protesta provar o alegado por todos os meios de prova em direito admitidos, notadamente: {{provas}}.

VI – DA OPÇÃO PELA AUDIÊNCIA DE CONCILIAÇÃO OU MEDIAÇÃO
O(A) autor(a) manifesta {{opcao_audiencia}} interesse na realização de audiência de conciliação ou mediação.

Dá-se à causa o valor de {{valor_causa}}.

Nestes termos, pede deferimento.

{{local}}, {{data.extenso}}.

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}
$tpl$, true),
('Contestação (estrutura)', 'contestacao', 'Estrutura de contestação (CPC, arts. 335 a 342).',
$tpl$EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA {{juizo}}

Processo nº {{processo.cnj}}

{{cliente.nome}}, já qualificado(a) nos autos da ação {{acao}} movida por {{autor.nome}}, por seu(sua) advogado(a), vem, respeitosamente, apresentar

CONTESTAÇÃO

pelos fundamentos de fato e de direito a seguir.

I – DA TEMPESTIVIDADE
{{tempestividade}}

II – SÍNTESE DA INICIAL
{{sintese}}

III – DAS PRELIMINARES
{{preliminares}}

IV – DO MÉRITO
{{merito}}

V – DAS PROVAS
Protesta provar o alegado por todos os meios de prova admitidos, notadamente: {{provas}}.

VI – DOS PEDIDOS
Ante o exposto, requer o acolhimento das preliminares suscitadas e, no mérito, a total improcedência dos pedidos, com a condenação do(a) autor(a) em custas e honorários advocatícios.

Nestes termos, pede deferimento.

{{local}}, {{data.extenso}}.

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}
$tpl$, true),
('Apelação cível (estrutura)', 'recurso', 'Estrutura de apelação (CPC, arts. 1.009 e 1.010).',
$tpl$EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA {{juizo}}

Processo nº {{processo.cnj}}

{{cliente.nome}}, já qualificado(a) nos autos da ação {{acao}}, por seu(sua) advogado(a), inconformado(a) com a sentença proferida, vem, respeitosamente, interpor

RECURSO DE APELAÇÃO

com fundamento nos arts. 1.009 e seguintes do Código de Processo Civil, requerendo o recebimento do recurso, a intimação da parte contrária para apresentar contrarrazões e a remessa dos autos ao Egrégio Tribunal competente.

RAZÕES DE APELAÇÃO

I – DA TEMPESTIVIDADE E DO PREPARO
{{tempestividade}}

II – SÍNTESE DOS FATOS E DA SENTENÇA
{{sintese}}

III – DAS RAZÕES PARA A REFORMA OU ANULAÇÃO DA SENTENÇA
{{razoes}}

IV – DO PEDIDO
Requer o conhecimento e o provimento do recurso para {{pedido_recursal}}.

Nestes termos, pede deferimento.

{{local}}, {{data.extenso}}.

{{advogado.nome}}
OAB/{{advogado.oab_uf}} nº {{advogado.oab}}
$tpl$, true);

update public.document_templates
set variables = array(
  select distinct m[1] from regexp_matches(body, '\{\{\s*([a-z_.]+)\s*\}\}', 'g') as m order by 1
)
where is_system;
