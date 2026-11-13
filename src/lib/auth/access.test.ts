import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountRole, canEditLegalRecords } from './access';
test('conta de cliente não concede edição de advogado', () => {
  assert.equal(accountRole(['client']), 'client');
  assert.equal(canEditLegalRecords('client'), false);
});
test('somente papel de advogado concede edição', () => {
  assert.equal(accountRole(['lawyer']), 'lawyer');
  assert.equal(canEditLegalRecords('lawyer'), true);
  assert.equal(accountRole([]), 'client');
});