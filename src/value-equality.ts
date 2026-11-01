/** Compare document values without serializing large embedded image strings. */
export function equalValue(a:unknown,b:unknown):boolean{
  if(a===b)return true;
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equalValue(v,b[i]));
  const left=a as Record<string,unknown>,right=b as Record<string,unknown>;
  const keys=Object.keys(left).filter(key=>left[key]!==undefined);
  return keys.length===Object.keys(right).filter(key=>right[key]!==undefined).length&&keys.every(key=>equalValue(left[key],right[key]));
}
