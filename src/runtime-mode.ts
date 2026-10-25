/** Build-time presentation switch; the document model and renderer stay shared. */
export const pagesMode=import.meta.env?.MODE==='pages';
export function publicAsset(path:string){return (import.meta.env?.BASE_URL??'/')+path.replace(/^\/+/, '');}
