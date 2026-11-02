/** URL focus takes precedence, including a missing ID; PDF startup ignores both. */
export function initialFocusTarget(parameters:URLSearchParams,saved?:string|null){
  if(parameters.get('pdf'))return null;
  return parameters.get('focus')||saved||null;
}
