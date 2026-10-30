import {reactionPositions,defaultReactionPlacement} from './reaction-layout';
import {createReactionPlacementPicker} from './reaction-placement-picker';
import {addNumberPresets,numberPresets} from './number-presets';
import type { DeskObject, Operation } from './model';
import { reactionChoices, reactionColor, isReactionMoon, hasReaction, canonicalReaction, type Reaction } from './reaction-values';
import { createReactionButtons } from './reaction-picker';
import { bounds, isConnector } from './geometry';
import { labelVisualBounds } from './label-description';
import { element } from './diagram-drawing';

/** A mixed selection adds to missing targets; an all-active selection removes from all. */
export function reactionOperations(objects: DeskObject[], reaction: Reaction): Operation[] {
  const remove = objects.every(object => hasReaction(object.reactions, reaction));
  return objects.flatMap(object => {
    const current = object.reactions ?? [];
    if (!remove && hasReaction(current, reaction)) return [];
    return [{ kind: 'update' as const, id: object.id,
      patch: { reactions: remove ? current.filter(value => canonicalReaction(value) !== canonicalReaction(reaction)) : [...current, canonicalReaction(reaction)] } }];
  });
}

export function createReactionControls(container: HTMLElement, selected: () => DeskObject[], apply: (operations: Operation[]) => void) {
  container.setAttribute('role', 'group'); container.setAttribute('aria-label', 'リアクション');

  const buttons = createReactionButtons(container, reaction => apply(reactionOperations(selected(), reaction)));

  // Preserve native Space activation instead of the canvas pan shortcut.
  container.addEventListener('keydown', event => { if (event.code === 'Space') event.stopPropagation(); });
  return {
    update(objects: DeskObject[]) {
      container.hidden = false;
      // Keep the list available while changing or clearing the editing selection.
      buttons.forEach(button => {
        button.disabled = !objects.length;
        const active = objects.filter(object => hasReaction(object.reactions, button.dataset.reaction as Reaction)).length;
        button.setAttribute('aria-pressed', active && active === objects.length ? 'true' : active ? 'mixed' : 'false');
      });
    },
  };
}

/** Badges remain inert and belong to their parent layer; placement never changes stacking. */
export function drawReactions(group: SVGGElement, object: DeskObject, descriptionsVisible: boolean, zoom = 1) {
  group.querySelector('[data-reactions]')?.remove();
  const active = reactionChoices.filter(reaction => hasReaction(object.reactions, reaction));
  if (!active.length) return;
  const visual = isConnector(object) ? bounds(object) : labelVisualBounds(object, descriptionsVisible);
  // Pins cancel camera zoom for their own glyph; restore it for the attached marks.
  const scale = (object.type === 'label' ? zoom : 1) * (object.reactionSize ?? 24) / 24 / (object.reactionFixed?zoom:1);
  const positions=reactionPositions(visual.width/scale,visual.height/scale,active.length,object.reactionPlacement);
  const badges = element('g', { 'data-reactions': object.id, 'pointer-events': 'none', 'aria-hidden': 'true',
    transform: `translate(${visual.x-object.x} ${visual.y-object.y}) scale(${scale})` });
  active.forEach((reaction, index) => {
    const {x:bx,y:by}=positions[index];
    badges.append(element('rect', { x: bx, y: by, width: 24, height: 24, rx: 8,
      fill: isReactionMoon(reaction)?'#cbd5e1':'#ffffff', stroke: '#cbd5e1', 'stroke-width': 1 }));
    const text = element('text', { x: bx + 12, y: by + 17, 'font-size': 16,
      'text-anchor': 'middle', 'font-family': 'sans-serif',...(reactionColor(reaction)?{fill:reactionColor(reaction)!}:{}) });
    text.textContent = reaction; badges.append(text);
  });
  group.append(badges);
}

/** Size is common to all reactions on each selected object, independent of pin series. */
export function createReactionSizeControls(form:HTMLElement, selected:()=>DeskObject[], apply:(operations:Operation[])=>void, report:(message:string,error?:boolean)=>void){
  const box=document.createElement('fieldset');box.id='reaction-size-controls';box.hidden=true;
  const legend=document.createElement('legend');legend.textContent='リアクション';
  const label=document.createElement('label');label.textContent='大きさ';
  const input=document.createElement('input');input.id='reaction-size';input.type='number';input.min='1';input.max='100000';input.step='any';input.setAttribute('aria-label','リアクションの大きさ');
  const row=document.createElement('div');row.className='reaction-settings-row';
  label.append(input);row.append(label);box.append(legend,row);form.after(box);
  addNumberPresets(input,numberPresets.fontSize.map(value=>value*2),'リアクションの大きさ');
  input.onchange=()=>{try{const size=Number(input.value);if(!input.value||!input.checkValidity())throw new Error('大きさを確認してください');apply(selected().map(object=>({kind:'update',id:object.id,patch:{reactionSize:size}})));}catch(error){report(error instanceof Error?error.message:String(error),true);}update();};
  const placement=createReactionPlacementPicker(row,value=>{try{apply(selected().map(object=>({kind:'update',id:object.id,patch:{reactionPlacement:value}})));}catch(error){report(error instanceof Error?error.message:String(error),true);}update();});
  const fixedLabel=document.createElement('label');fixedLabel.className='reaction-fixed';
  const fixed=document.createElement('input');fixed.type='checkbox';fixed.id='reaction-fixed';fixedLabel.append(fixed,'ズーム固定');box.append(fixedLabel);
  fixed.onchange=()=>{try{apply(selected().map(object=>({kind:'update',id:object.id,patch:{reactionFixed:fixed.checked}})));}catch(error){report(error instanceof Error?error.message:String(error),true);}update();};
  input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();input.blur();}});
  box.addEventListener('keydown',event=>event.stopPropagation());
  function update(){const objects=selected();box.hidden=!objects.length;const flags=objects.map(o=>o.reactionFixed??false);fixed.checked=flags[0]??false;fixed.indeterminate=flags.some(value=>value!==flags[0]);const sizes=objects.map(o=>o.reactionSize??24);input.value=sizes.length&&sizes.every(s=>s===sizes[0])?String(sizes[0]):'';input.placeholder='複数';const values=objects.map(o=>o.reactionPlacement??defaultReactionPlacement);placement.update(values.length&&values.every(value=>value===values[0])?values[0]:undefined);}
  return {update};
}
