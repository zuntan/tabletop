import { checkResourceKeys, resources } from '../src/i18n/resources';

const errors = checkResourceKeys(resources);
if (errors.length) throw new Error(`Translation catalog mismatch:\n${errors.join('\n')}`);
console.log(`Translation keys match: ${Object.keys(resources).join(', ')}`);
