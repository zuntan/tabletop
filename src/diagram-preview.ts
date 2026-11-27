import {createHeldEditorPreview} from './held-editor-preview';
import {renderMermaid} from './mermaid-card';
import {renderWireloom} from './wireloom-card';
import {uiErrorMessage} from './i18n/errors';
import {t} from './i18n';

export function createDiagramPreview(panel:HTMLElement,input:HTMLTextAreaElement,actions:HTMLElement,type:'mermaid'|'wireloom') {
  return createHeldEditorPreview(panel,input,actions,{
    className:'editor-diagram-preview',title:'editing:diagramPreviewHold',
    label:'editing:diagramPreview',draftLabel:'editing:diagramPreviewDraft',
    render:(preview,isCurrent)=>{
      preview.dataset.diagramPreview=type;preview.dataset.previewStatus='loading';
      preview.textContent=t(type==='mermaid'?'creation:mermaidLoading':'creation:wireloomLoading');
      const source=input.value;
      void (type==='mermaid'?renderMermaid(source):renderWireloom(source)).then(async result=>{
        if(!isCurrent())return;
        const image=new Image();image.alt=type==='mermaid'?'Mermaid':'Wireloom';image.src=result.src;
        await image.decode();
        if(!isCurrent())return;
        preview.replaceChildren(image);preview.dataset.previewStatus='ready';
      }).catch(error=>{
        if(!isCurrent())return;
        preview.textContent=uiErrorMessage(error);preview.dataset.previewStatus='error';preview.style.color='#b91c1c';
      });
    },
  });
}
