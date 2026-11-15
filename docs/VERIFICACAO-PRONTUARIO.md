# Verificação desta entrega

Executada contra o servidor Node compilado e o backend local independente, com contas e dados fictícios.

- TypeScript e build de produção: passaram.
- Lint dos módulos alterados: passou.
- 15 testes de validação, acesso e adaptador de IA: passaram, sem chamadas pagas.
- Integração HTTP real: autenticação; tentativa de autopromoção por metadata; ativação idempotente; clientes e inquérito sem CNJ; versões e conflito de nota; isolamento entre escritórios e cliente; original privado; bloqueio de sobrescrita; conferência de SHA-256; conclusão idempotente; auditoria; download; processo e agenda: passaram.
- 6 verificações de navegador, em desktop e em viewport móvel: cadastro de cliente/inquérito persistente; nota, revisão, histórico, recarga, envio e download; bloqueio de entrada profissional ao cliente: passaram. Simulação móvel no Chromium, sem validação em aparelho físico/Safari nesta etapa.
- Verificação SQL: nenhuma tabela pública sem RLS, nenhuma função pública SECURITY DEFINER e nenhuma permissão de tabela pública para `anon`. Bucket de originais privado e limitado a 10 MB.
- Nova execução das migrations aplicadas: validou os hashes sem reaplicar DDL.

Os testes encontraram e levaram à correção de dois problemas de navegação: formulário utilizável antes da hidratação e rota filha do prontuário escondida pela listagem. O perfil profissional passou a mostrar o nome autenticado.

O ambiente tem limitação de armazenamento e usa uma cópia local reduzida da imagem oficial de Storage para os testes; o Compose distribuído aponta para a imagem oficial completa. Nenhum banco externo foi modificado. O destino público, os e-mails de produção, as credenciais reais de IA e a operação de limpeza/backup ainda não foram configurados.
