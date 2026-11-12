import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordValid,roleNames,hasRole } from '../src/auth-policy.js';

test('contraseñas: longitud, mayúsculas, minúsculas y número',()=>{
 assert.equal(passwordValid('ClaveSegura2026'),true);
 assert.equal(passwordValid('corta1A'),false);
 assert.equal(passwordValid('todosminuscula123'),false);
 assert.equal(passwordValid('TODOMAYUSCULA123'),false);
 assert.equal(passwordValid('SinDigitosAAAA'),false);
 assert.equal(passwordValid('A1a'+'x'.repeat(126)),false);
});
test('permisos: cuatro roles distintos y rechazo de rol ausente',()=>{
 assert.equal(new Set(Object.values(roleNames)).size,4);
 assert.equal(hasRole({roles:[roleNames.PERSONAL]},roleNames.ADMIN),false);
 assert.equal(hasRole({roles:[roleNames.ADMIN]},roleNames.ADMIN),true);
 assert.equal(hasRole(null,roleNames.ADMIN),false);
});
