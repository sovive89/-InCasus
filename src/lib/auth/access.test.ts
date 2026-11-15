import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountRole, canEditLegalRecords, lawyerEntryRedirect } from './access';
test('conta de cliente não concede edição de advogado', () => {
  assert.equal(accountRole(['client']), 'client');
  assert.equal(canEditLegalRecords('client'), false);
});
test('somente papel de advogado concede edição', () => {
  assert.equal(accountRole(['lawyer']), 'lawyer');
  assert.equal(canEditLegalRecords('lawyer'), true);
  assert.equal(accountRole([]), 'client');
});

test('entrada profissional abre o painel sem produzir um layout vazio', () => {
  assert.equal(lawyerEntryRedirect('lawyer', '/advogado'), '/advogado/dashboard');
  assert.equal(lawyerEntryRedirect('lawyer', '/advogado/'), '/advogado/dashboard');
  assert.equal(lawyerEntryRedirect('lawyer', '/advogado/dashboard'), null);
  assert.equal(lawyerEntryRedirect('lawyer', '/advogado/processos/123'), null);
});

test('URL profissional não concede acesso a clientes nem a papel desconhecido', () => {
  for (const role of ['client', '', 'admin']) {
    assert.equal(lawyerEntryRedirect(role, '/advogado'), '/cliente');
    assert.equal(lawyerEntryRedirect(role, '/advogado/dashboard'), '/cliente');
  }
});
