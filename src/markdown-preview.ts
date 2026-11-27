import {createHeldEditorPreview} from './held-editor-preview';
import {renderMarkdown} from './markdown';
import {hydrateMarkdownImages} from './markdown-images';

/** A held view of the draft, never a write to the desk or a second editor. */
export function createMarkdownPreview(panel:HTMLElement,input:HTMLTextAreaElement,actions:HTMLElement) {
  return createHeldEditorPreview(panel,input,actions,{
    className:'markdown-text editor-markdown-preview',title:'editing:previewHold',
    label:'editing:preview',draftLabel:'editing:previewDraft',
    render:preview=>{preview.innerHTML=renderMarkdown(input.value);hydrateMarkdownImages(preview);},
  });
}
